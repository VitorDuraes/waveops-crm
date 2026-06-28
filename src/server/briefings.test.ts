// src/server/briefings.test.ts — testes PUROS do repo de briefings (1 por empresa, upsert), sem banco real.
// Fake in-memory table-aware de DbOrTx que interpreta o chain Drizzle usado pelo repo:
//   select({id}).from(empresas).where(eq).limit()                  | lookup de empresa
//   select({id}).from(briefings).where(eq(empresaId)).limit()      | checa briefing existente da empresa
//   insert(briefings).values(v).returning()                        | cria quando nao existe
//   update(briefings).set(v).where(eq(id)).returning()             | atualiza quando ja existe (idempotente)
//   select().from(briefings).where(eq(empresaId)).limit()          | getBriefingByEmpresa
// Replica o mecanismo de empresas.test.ts / faturas.test.ts (fake, sem Docker/Postgres),
// estendido para a tabela briefings no store, no tableNameOf e no withDefaults.
import { describe, expect, it } from "vitest";
import { briefings, empresas } from "@/db/schema";
import { getBriefingByEmpresa, upsertBriefing } from "./briefings";
import type { DbOrTx } from "./types";

// Mapa nome-de-coluna-no-banco (snake_case) -> chave camelCase do row, por tabela.
function keyMap(table: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(table)
      .filter(([, col]) => col && typeof col === "object" && "name" in (col as object))
      .map(([key, col]) => [(col as { name?: string }).name ?? key, key]),
  );
}

const KEYS = {
  empresas: keyMap(empresas as unknown as Record<string, unknown>),
  briefings: keyMap(briefings as unknown as Record<string, unknown>),
};

type Row = Record<string, unknown>;
type TableName = "empresas" | "briefings";

// Avalia uma condicao Drizzle (SQL) contra um row de uma unica tabela. Suporta eq e and.
function matches(condition: unknown, row: Row, keys: Record<string, string>): boolean {
  const chunks = (condition as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return true;

  const nested = chunks.filter(
    (c) => (c as { constructor?: { name?: string } })?.constructor?.name === "SQL",
  );
  if (nested.length > 0) return nested.every((n) => matches(n, row, keys));

  let columnName: string | undefined;
  const params: unknown[] = [];
  for (const c of chunks) {
    const ctor = (c as { constructor?: { name?: string } })?.constructor?.name;
    if (ctor && ctor.startsWith("Pg")) columnName = (c as { name?: string }).name;
    else if (ctor === "Param") params.push((c as { value?: unknown }).value);
  }
  if (!columnName) return true;
  const key = keys[columnName] ?? columnName;
  return row[key] === params[0];
}

function tableNameOf(table: unknown): TableName {
  if (table === empresas) return "empresas";
  if (table === briefings) return "briefings";
  throw new Error("tabela desconhecida no fake");
}

// Defaults por tabela (colunas com default/nullable no schema que o repo nao informa no insert).
function withDefaults(table: string, values: Row, id: string): Row {
  const base: Row = { id, createdAt: new Date(), updatedAt: new Date() };
  if (table === "briefings") {
    return {
      objetivo: null,
      ferramentaAtual: null,
      dor: null,
      volume: null,
      trelloCardId: null,
      ...base,
      ...values,
    };
  }
  return { ...base, ...values };
}

function makeFakeDb() {
  const store: Record<string, Row[]> = { empresas: [], briefings: [] };
  let seq = 0;

  const db = {
    select() {
      return {
        from(table: unknown) {
          const baseName = tableNameOf(table);
          // Caminho unico do repo: select(...).from(t).where(eq).limit(1).
          // A projecao nao importa: o repo so checa truthiness (existing/empresa) ou usa o row inteiro.
          return {
            where(condition: unknown) {
              const rows = () =>
                store[baseName].filter((r) => matches(condition, r, KEYS[baseName]));
              return {
                limit() {
                  return Promise.resolve(rows().slice(0, 1));
                },
              };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      const name = tableNameOf(table);
      return {
        values(values: Row) {
          return {
            returning() {
              const row = withDefaults(name, values, `${name}-${++seq}`);
              store[name].push(row);
              return Promise.resolve([row]);
            },
          };
        },
      };
    },
    update(table: unknown) {
      const name = tableNameOf(table);
      return {
        set(values: Row) {
          return {
            where(condition: unknown) {
              return {
                returning() {
                  const idx = store[name].findIndex((r) => matches(condition, r, KEYS[name]));
                  if (idx < 0) return Promise.resolve([]);
                  store[name][idx] = { ...store[name][idx], ...values };
                  return Promise.resolve([store[name][idx]]);
                },
              };
            },
          };
        },
      };
    },
  } as unknown as DbOrTx;

  return { db, store };
}

function seedEmpresa(store: Record<string, Row[]>, over: Row = {}): Row {
  const emp: Row = {
    id: `empresas-seed-${store.empresas.length + 1}`,
    name: "Empresa Seed",
    statusDoCliente: "lead",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
  store.empresas.push(emp);
  return emp;
}

describe("upsertBriefing — cria", () => {
  it("cria quando nao existe briefing da empresa (criado:true)", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });

    const result = await upsertBriefing(db, {
      empresaId: emp.id as string,
      objetivo: "  Automatizar cobranca  ",
      ferramentaAtual: "Planilha",
      dor: "  Atraso no follow-up  ",
      volume: "200 leads/mes",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.criado).toBe(true);
    expect(store.briefings).toHaveLength(1);
    expect(result.briefing.empresaId).toBe("emp-1");
    expect(result.briefing.objetivo).toBe("Automatizar cobranca"); // trim aplicado
    expect(result.briefing.dor).toBe("Atraso no follow-up");
    expect(result.briefing.ferramentaAtual).toBe("Planilha");
  });

  it("campos vazios viram null", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const result = await upsertBriefing(db, { empresaId: emp.id as string, objetivo: "   " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.briefing.objetivo).toBeNull();
    expect(result.briefing.dor).toBeNull();
  });
});

describe("upsertBriefing — atualiza (idempotente por empresa)", () => {
  it("atualiza quando ja existe para a empresa (criado:false, sem duplicar)", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });

    const first = await upsertBriefing(db, {
      empresaId: emp.id as string,
      objetivo: "Versao 1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstId = first.briefing.id;

    const second = await upsertBriefing(db, {
      empresaId: emp.id as string,
      objetivo: "Versao 2",
      dor: "Nova dor",
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.criado).toBe(false);
    expect(store.briefings).toHaveLength(1); // nao duplicou
    expect(second.briefing.id).toBe(firstId); // mesmo registro
    expect(second.briefing.objetivo).toBe("Versao 2");
    expect(second.briefing.dor).toBe("Nova dor");
  });
});

describe("upsertBriefing — erros", () => {
  it("sem empresaId -> missing_fields (nao consulta empresa)", async () => {
    const { db, store } = makeFakeDb();
    const result = await upsertBriefing(db, { empresaId: "" });
    expect(result).toEqual({ ok: false, error: "missing_fields" });
    expect(store.briefings).toHaveLength(0);
  });

  it("empresa inexistente -> empresa_not_found", async () => {
    const { db, store } = makeFakeDb();
    const result = await upsertBriefing(db, { empresaId: "nao-existe", objetivo: "Algo" });
    expect(result).toEqual({ ok: false, error: "empresa_not_found" });
    expect(store.briefings).toHaveLength(0);
  });
});

describe("getBriefingByEmpresa", () => {
  it("retorna o briefing da empresa quando existe", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    await upsertBriefing(db, { empresaId: emp.id as string, objetivo: "Escopo X" });

    const found = await getBriefingByEmpresa(db, "emp-1");
    expect(found).not.toBeNull();
    expect(found?.empresaId).toBe("emp-1");
    expect(found?.objetivo).toBe("Escopo X");
  });

  it("retorna null quando a empresa nao tem briefing", async () => {
    const { db } = makeFakeDb();
    const found = await getBriefingByEmpresa(db, "sem-briefing");
    expect(found).toBeNull();
  });
});

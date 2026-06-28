// src/server/diagnosticos.test.ts — testes PUROS do repo de diagnosticos (sem banco real).
// Fake in-memory table-aware de DbOrTx que interpreta o chain Drizzle usado pelo repo:
//   select(...).from(tabela).where(eq).limit()           | leitura projetada da oportunidade
//   insert(tabela).values(v).returning()                 | escrita do diagnostico
//   select().from(tabela).where(eq).orderBy(desc)        | listagem por oportunidade
// Replica o mecanismo de empresas.test.ts / ingest.test.ts (fake, sem Docker/Postgres).
import { describe, expect, it } from "vitest";
import { diagnosticos, oportunidades } from "@/db/schema";
import { createDiagnostico, listDiagnosticosByOportunidade } from "./diagnosticos";
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
  diagnosticos: keyMap(diagnosticos as unknown as Record<string, unknown>),
  oportunidades: keyMap(oportunidades as unknown as Record<string, unknown>),
};

type Row = Record<string, unknown>;

// Avalia uma condicao Drizzle (SQL) contra um row. Suporta eq e and.
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

function tableNameOf(table: unknown): "diagnosticos" | "oportunidades" {
  if (table === diagnosticos) return "diagnosticos";
  if (table === oportunidades) return "oportunidades";
  throw new Error("tabela desconhecida no fake");
}

// Defaults por tabela (colunas com default no schema que o repo nao informa no insert).
function withDefaults(table: string, values: Row, id: string): Row {
  const base: Row = { id, createdAt: new Date(), updatedAt: new Date() };
  if (table === "diagnosticos") {
    return { dor: null, processoAtual: null, ferramentas: null, volume: null, fit: null, ...base, ...values };
  }
  return { ...base, ...values };
}

function makeFakeDb() {
  const store: Record<string, Row[]> = { diagnosticos: [], oportunidades: [] };
  let seq = 0;

  const db = {
    select() {
      return {
        from(table: unknown) {
          const name = tableNameOf(table);
          // Resolve as linhas filtradas; o resultado e uma "query" thenable que tambem
          // expõe limit() e orderBy() (passthrough, ordenacao validada por outro teste).
          const queryFrom = (filter: (r: Row) => boolean) => {
            const result = () => store[name].filter(filter);
            const query: Record<string, unknown> = {
              limit() {
                return Promise.resolve(result().slice(0, 1));
              },
              orderBy() {
                return Promise.resolve(result());
              },
              then(onF: (v: Row[]) => unknown, onR?: (e: unknown) => unknown) {
                return Promise.resolve(result()).then(onF, onR);
              },
            };
            return query;
          };
          return {
            where(condition: unknown) {
              return queryFrom((r) => matches(condition, r, KEYS[name]));
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
  } as unknown as DbOrTx;

  return { db, store };
}

// Semeia uma oportunidade no store para os caminhos que dependem de FK.
function seedOportunidade(store: Record<string, Row[]>, over: Row = {}): Row {
  const op: Row = {
    id: `oportunidades-seed-${store.oportunidades.length + 1}`,
    name: "Op Seed",
    stage: "novo_lead",
    empresaId: `empresas-${store.oportunidades.length + 1}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
  store.oportunidades.push(op);
  return op;
}

describe("createDiagnostico — happy path", () => {
  it("cria diagnostico derivando empresaId da oportunidade", async () => {
    const { db, store } = makeFakeDb();
    const op = seedOportunidade(store, { empresaId: "empresa-xyz" });

    const result = await createDiagnostico(db, {
      oportunidadeId: op.id as string,
      dor: "  processo manual  ",
      processoAtual: "planilha",
      ferramentas: "excel",
      volume: "200/mes",
      fit: "alto",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.diagnosticos).toHaveLength(1);
    expect(result.diagnostico.oportunidadeId).toBe(op.id);
    expect(result.diagnostico.empresaId).toBe("empresa-xyz"); // derivado da oportunidade
    expect(result.diagnostico.dor).toBe("processo manual"); // trim aplicado
    expect(result.diagnostico.fit).toBe("alto");
  });
});

describe("createDiagnostico — erros", () => {
  it("oportunidadeId ausente -> missing_fields", async () => {
    const { db } = makeFakeDb();
    const result = await createDiagnostico(db, { oportunidadeId: "" });
    expect(result).toEqual({ ok: false, error: "missing_fields" });
  });

  it("oportunidade inexistente -> oportunidade_not_found", async () => {
    const { db, store } = makeFakeDb();
    const result = await createDiagnostico(db, { oportunidadeId: "nao-existe", fit: "alto" });
    expect(result).toEqual({ ok: false, error: "oportunidade_not_found" });
    expect(store.diagnosticos).toHaveLength(0);
  });

  it("fit invalido -> invalid_fit (nao consulta oportunidade)", async () => {
    const { db, store } = makeFakeDb();
    seedOportunidade(store, { id: "op-1" });
    const result = await createDiagnostico(db, { oportunidadeId: "op-1", fit: "altissimo" });
    expect(result).toEqual({ ok: false, error: "invalid_fit" });
    expect(store.diagnosticos).toHaveLength(0);
  });
});

describe("listDiagnosticosByOportunidade", () => {
  it("retorna apenas os diagnosticos da oportunidade informada", async () => {
    const { db, store } = makeFakeDb();
    const opA = seedOportunidade(store, { id: "op-a", empresaId: "emp-a" });
    const opB = seedOportunidade(store, { id: "op-b", empresaId: "emp-b" });

    await createDiagnostico(db, { oportunidadeId: opA.id as string, dor: "dor A1" });
    await createDiagnostico(db, { oportunidadeId: opA.id as string, dor: "dor A2" });
    await createDiagnostico(db, { oportunidadeId: opB.id as string, dor: "dor B1" });

    const listA = await listDiagnosticosByOportunidade(db, "op-a");
    expect(listA).toHaveLength(2);
    expect(listA.every((d) => d.oportunidadeId === "op-a")).toBe(true);

    const listB = await listDiagnosticosByOportunidade(db, "op-b");
    expect(listB).toHaveLength(1);
    expect(listB[0].dor).toBe("dor B1");
  });
});

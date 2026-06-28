// src/server/propostas.test.ts — testes PUROS do repo de propostas (sem banco real).
// Fake in-memory table-aware de DbOrTx que interpreta o chain Drizzle usado pelo repo:
//   select(...).from(tabela).where(eq).limit()                  | leitura projetada (oportunidade / dataEnvio)
//   insert(tabela).values(v).returning()                        | escrita da proposta
//   update(tabela).set(v).where(eq(id)).returning()             | mover status no kanban
//   select(proj).from(propostas).innerJoin(...).innerJoin(...)  | listPropostasComContexto
//     .orderBy(asc)
// Replica o mecanismo de empresas.test.ts / ingest.test.ts (fake, sem Docker/Postgres).
import { describe, expect, it } from "vitest";
import { empresas, oportunidades, propostas } from "@/db/schema";
import {
  createProposta,
  listPropostasComContexto,
  updatePropostaStatus,
} from "./propostas";
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
  oportunidades: keyMap(oportunidades as unknown as Record<string, unknown>),
  propostas: keyMap(propostas as unknown as Record<string, unknown>),
};

type Row = Record<string, unknown>;

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

// Le (tabela, coluna-camel) de cada lado de um eq(colA, colB) sem Param (chave de join).
function readJoinKeys(condition: unknown): { left: string; right: string } | null {
  const chunks = (condition as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return null;
  const cols: { table: unknown; key: string }[] = [];
  for (const c of chunks) {
    const ctor = (c as { constructor?: { name?: string } })?.constructor?.name;
    if (ctor && ctor.startsWith("Pg")) {
      const name = (c as { name?: string }).name as string;
      const table = (c as { table?: unknown }).table;
      const tName = tableNameOf(table);
      cols.push({ table, key: KEYS[tName][name] ?? name });
    }
  }
  if (cols.length !== 2) return null;
  return { left: cols[0].key, right: cols[1].key };
}

function tableNameOf(table: unknown): "empresas" | "oportunidades" | "propostas" {
  if (table === empresas) return "empresas";
  if (table === oportunidades) return "oportunidades";
  if (table === propostas) return "propostas";
  throw new Error("tabela desconhecida no fake");
}

// Defaults por tabela (colunas com default no schema que o repo nao informa no insert).
function withDefaults(table: string, values: Row, id: string): Row {
  const base: Row = { id, createdAt: new Date(), updatedAt: new Date() };
  if (table === "propostas") {
    return { status: "rascunho", dataEnvio: null, validade: null, link: null, ...base, ...values };
  }
  return { ...base, ...values };
}

function makeFakeDb() {
  const store: Record<string, Row[]> = { empresas: [], oportunidades: [], propostas: [] };
  let seq = 0;

  const db = {
    select(projection?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          const baseName = tableNameOf(table);
          // Caminho 1: select simples (com ou sem projecao) sobre uma tabela.
          const simpleQuery = (filter: (r: Row) => boolean) => {
            const rows = () => store[baseName].filter(filter);
            return {
              limit() {
                return Promise.resolve(rows().slice(0, 1));
              },
              orderBy() {
                return Promise.resolve(rows());
              },
              then(onF: (v: Row[]) => unknown, onR?: (e: unknown) => unknown) {
                return Promise.resolve(rows()).then(onF, onR);
              },
            };
          };
          // Caminho 2: select com innerJoin (listPropostasComContexto).
          // Acumula joins e materializa linhas projetadas no orderBy/then.
          const joins: { table: unknown; on: unknown }[] = [];
          const joinResult = (): Row[] => {
            return store[baseName].map((base) => {
              const out: Row = { [baseName]: base };
              for (const j of joins) {
                const jName = tableNameOf(j.table);
                const keysJoin = readJoinKeys(j.on);
                const match = store[jName].find((cand) => {
                  if (!keysJoin) return false;
                  // a chave de join pode pertencer a qualquer um dos dois lados.
                  return (
                    base[keysJoin.left] === cand[keysJoin.right] ||
                    base[keysJoin.right] === cand[keysJoin.left]
                  );
                });
                out[jName] = match ?? null;
              }
              return out;
            });
          };
          const project = (rows: Row[]): Row[] =>
            rows.map((joined) => {
              const proj: Row = {};
              for (const [alias, col] of Object.entries(projection ?? {})) {
                // Coluna inteira da tabela (ex: proposta: propostas) -> objeto da tabela.
                const isWholeTable = col === propostas || col === empresas || col === oportunidades;
                if (isWholeTable) {
                  proj[alias] = joined[tableNameOf(col)];
                  continue;
                }
                // Coluna individual (ex: empresas.name) -> valor da tabela correspondente.
                const tName = tableNameOf((col as { table?: unknown }).table);
                const cName = (col as { name?: string }).name as string;
                const cell = joined[tName] as Row | null;
                proj[alias] = cell ? cell[KEYS[tName][cName] ?? cName] : null;
              }
              return proj;
            });
          const joinChain = {
            innerJoin(joinTable: unknown, on: unknown) {
              joins.push({ table: joinTable, on });
              return joinChain;
            },
            orderBy() {
              return Promise.resolve(project(joinResult()));
            },
            then(onF: (v: Row[]) => unknown, onR?: (e: unknown) => unknown) {
              return Promise.resolve(project(joinResult())).then(onF, onR);
            },
          };
          return {
            where(condition: unknown) {
              return simpleQuery((r) => matches(condition, r, KEYS[baseName]));
            },
            innerJoin(joinTable: unknown, on: unknown) {
              joins.push({ table: joinTable, on });
              return joinChain;
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

describe("createProposta — happy path", () => {
  it("cria proposta derivando empresaId da oportunidade", async () => {
    const { db, store } = makeFakeDb();
    const op = seedOportunidade(store, { empresaId: "empresa-99" });

    const result = await createProposta(db, {
      name: "  Plano Pro WaveOps  ",
      oportunidadeId: op.id as string,
      plano: "pro",
      valorMensalCents: 99700,
      valorSetupCents: 50000,
      escopo: "  automacao + dashboard  ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.propostas).toHaveLength(1);
    expect(result.proposta.name).toBe("Plano Pro WaveOps"); // trim aplicado
    expect(result.proposta.empresaId).toBe("empresa-99"); // derivado da oportunidade
    expect(result.proposta.plano).toBe("pro");
    expect(result.proposta.status).toBe("rascunho"); // default do schema
    expect(result.proposta.escopo).toBe("automacao + dashboard");
  });
});

describe("createProposta — erros", () => {
  it("name vazio -> missing_fields", async () => {
    const { db } = makeFakeDb();
    const result = await createProposta(db, { name: "   ", oportunidadeId: "op-1" });
    expect(result).toEqual({ ok: false, error: "missing_fields" });
  });

  it("oportunidade inexistente -> oportunidade_not_found", async () => {
    const { db, store } = makeFakeDb();
    const result = await createProposta(db, { name: "X", oportunidadeId: "nao-existe" });
    expect(result).toEqual({ ok: false, error: "oportunidade_not_found" });
    expect(store.propostas).toHaveLength(0);
  });

  it("plano invalido -> invalid_plano (nao consulta oportunidade)", async () => {
    const { db, store } = makeFakeDb();
    seedOportunidade(store, { id: "op-1" });
    const result = await createProposta(db, { name: "X", oportunidadeId: "op-1", plano: "premium" });
    expect(result).toEqual({ ok: false, error: "invalid_plano" });
    expect(store.propostas).toHaveLength(0);
  });
});

describe("updatePropostaStatus", () => {
  it("muda status e carimba dataEnvio ao enviar", async () => {
    const { db, store } = makeFakeDb();
    const op = seedOportunidade(store, { id: "op-1", empresaId: "emp-1" });
    const created = await createProposta(db, { name: "P1", oportunidadeId: op.id as string });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updatePropostaStatus(db, created.proposta.id, "enviada");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposta.status).toBe("enviada");
    expect(result.proposta.dataEnvio).toBeInstanceOf(Date); // carimbada no envio
  });

  it("status invalido -> invalid_status", async () => {
    const { db } = makeFakeDb();
    const result = await updatePropostaStatus(db, "qualquer-id", "publicada");
    expect(result).toEqual({ ok: false, error: "invalid_status" });
  });

  it("proposta inexistente -> not_found", async () => {
    const { db } = makeFakeDb();
    const result = await updatePropostaStatus(db, "nao-existe", "aceita");
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("listPropostasComContexto", () => {
  it("traz empresaName e oportunidadeName de cada proposta", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1", name: "Studio Bella" });
    const op = seedOportunidade(store, {
      id: "op-1",
      name: "Studio Bella — Plano Pro",
      empresaId: emp.id,
    });
    const created = await createProposta(db, {
      name: "Proposta Studio",
      oportunidadeId: op.id as string,
    });
    expect(created.ok).toBe(true);

    const list = await listPropostasComContexto(db);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Proposta Studio"); // campos da propria proposta preservados
    expect(list[0].empresaName).toBe("Studio Bella");
    expect(list[0].oportunidadeName).toBe("Studio Bella — Plano Pro");
  });
});

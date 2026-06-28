// src/server/faturas.test.ts — testes PUROS do repo de faturas (sem banco real).
// Fake in-memory table-aware de DbOrTx que interpreta o chain Drizzle usado pelo repo:
//   select({id}).from(empresas).where(eq).limit()                            | lookup de empresa
//   insert(faturas).values(v).returning()                                    | escrita da fatura
//   update(faturas).set(v).where(eq(id)).returning()                         | marcar paga / mudar status
//   select(proj).from(faturas).innerJoin(empresas).where(where?).orderBy(asc) | listFaturasComEmpresa
// Replica o mecanismo de empresas.test.ts / propostas.test.ts (fake, sem Docker/Postgres),
// estendido com where() pos-innerJoin (filtro opcional por status na tela de cobranca).
import { describe, expect, it } from "vitest";
import { empresas, faturas } from "@/db/schema";
import {
  createFatura,
  listFaturasComEmpresa,
  marcarFaturaPaga,
  updateFaturaStatus,
} from "./faturas";
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
  faturas: keyMap(faturas as unknown as Record<string, unknown>),
};

type Row = Record<string, unknown>;
type TableName = "empresas" | "faturas";

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
  const cols: { key: string }[] = [];
  for (const c of chunks) {
    const ctor = (c as { constructor?: { name?: string } })?.constructor?.name;
    if (ctor && ctor.startsWith("Pg")) {
      const name = (c as { name?: string }).name as string;
      const table = (c as { table?: unknown }).table;
      const tName = tableNameOf(table);
      cols.push({ key: KEYS[tName][name] ?? name });
    }
  }
  if (cols.length !== 2) return null;
  return { left: cols[0].key, right: cols[1].key };
}

function tableNameOf(table: unknown): TableName {
  if (table === empresas) return "empresas";
  if (table === faturas) return "faturas";
  throw new Error("tabela desconhecida no fake");
}

// Defaults por tabela (colunas com default no schema que o repo nao informa no insert).
function withDefaults(table: string, values: Row, id: string): Row {
  const base: Row = { id, createdAt: new Date(), updatedAt: new Date() };
  if (table === "faturas") {
    return {
      status: "em_aberto",
      name: null,
      vencimento: null,
      pagoEm: null,
      formaPagamento: null,
      linkDePagamento: null,
      gatewayPaymentId: null,
      assinaturaId: null,
      ...base,
      ...values,
    };
  }
  return { ...base, ...values };
}

function makeFakeDb() {
  const store: Record<string, Row[]> = { empresas: [], faturas: [] };
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
          // Caminho 2: select com innerJoin (listFaturasComEmpresa), com where opcional pos-join.
          const joins: { table: unknown; on: unknown }[] = [];
          let baseFilter: (r: Row) => boolean = () => true;
          const joinResult = (): Row[] => {
            return store[baseName].filter(baseFilter).map((base) => {
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
                // Coluna inteira da tabela (ex: fatura: faturas) -> objeto da tabela.
                const isWholeTable = col === faturas || col === empresas;
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
            // where opcional pos-join: undefined nao filtra; eq(status) filtra a tabela base.
            where(condition: unknown) {
              if (condition !== undefined) {
                baseFilter = (r: Row) => matches(condition, r, KEYS[baseName]);
              }
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

describe("createFatura — happy path", () => {
  it("cria fatura com forma e status informados", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });

    const result = await createFatura(db, {
      empresaId: emp.id as string,
      valorCents: 99700,
      formaPagamento: "pix",
      status: "em_aberto",
      vencimento: new Date("2026-07-10"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.faturas).toHaveLength(1);
    expect(result.fatura.empresaId).toBe("emp-1");
    expect(result.fatura.valorCents).toBe(99700);
    expect(result.fatura.formaPagamento).toBe("pix");
    expect(result.fatura.status).toBe("em_aberto");
  });

  it("status default em_aberto quando ausente", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const result = await createFatura(db, { empresaId: emp.id as string, valorCents: 5000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fatura.status).toBe("em_aberto"); // default do schema
    expect(result.fatura.formaPagamento).toBeNull();
  });
});

describe("createFatura — erros", () => {
  it("sem empresa -> missing_fields", async () => {
    const { db, store } = makeFakeDb();
    const result = await createFatura(db, {
      empresaId: "",
      valorCents: 1000,
    });
    expect(result).toEqual({ ok: false, error: "missing_fields" });
    expect(store.faturas).toHaveLength(0);
  });

  it("sem valor ou valor <= 0 -> invalid_valor", async () => {
    const { db, store } = makeFakeDb();
    seedEmpresa(store, { id: "emp-1" });
    expect(
      await createFatura(db, { empresaId: "emp-1", valorCents: undefined as unknown as number }),
    ).toEqual({ ok: false, error: "invalid_valor" });
    expect(await createFatura(db, { empresaId: "emp-1", valorCents: 0 })).toEqual({
      ok: false,
      error: "invalid_valor",
    });
    expect(await createFatura(db, { empresaId: "emp-1", valorCents: -100 })).toEqual({
      ok: false,
      error: "invalid_valor",
    });
    expect(store.faturas).toHaveLength(0);
  });

  it("empresa inexistente -> empresa_not_found", async () => {
    const { db, store } = makeFakeDb();
    const result = await createFatura(db, { empresaId: "nao-existe", valorCents: 1000 });
    expect(result).toEqual({ ok: false, error: "empresa_not_found" });
    expect(store.faturas).toHaveLength(0);
  });

  it("status invalido -> invalid_status (nao consulta empresa)", async () => {
    const { db, store } = makeFakeDb();
    const result = await createFatura(db, {
      empresaId: "emp-1",
      valorCents: 1000,
      status: "nao_existe",
    });
    expect(result).toEqual({ ok: false, error: "invalid_status" });
    expect(store.faturas).toHaveLength(0);
  });

  it("forma de pagamento invalida -> invalid_forma", async () => {
    const { db, store } = makeFakeDb();
    const result = await createFatura(db, {
      empresaId: "emp-1",
      valorCents: 1000,
      formaPagamento: "dinheiro",
    });
    expect(result).toEqual({ ok: false, error: "invalid_forma" });
    expect(store.faturas).toHaveLength(0);
  });
});

describe("marcarFaturaPaga", () => {
  it("status vira paga e carimba pagoEm", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const created = await createFatura(db, { empresaId: emp.id as string, valorCents: 1000 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await marcarFaturaPaga(db, created.fatura.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fatura.status).toBe("paga");
    expect(result.fatura.pagoEm).toBeInstanceOf(Date); // carimbada no pagamento
  });

  it("fatura inexistente -> not_found", async () => {
    const { db } = makeFakeDb();
    const result = await marcarFaturaPaga(db, "nao-existe");
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("updateFaturaStatus", () => {
  it("muda status com sucesso", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const created = await createFatura(db, { empresaId: emp.id as string, valorCents: 1000 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateFaturaStatus(db, created.fatura.id, "vencida");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fatura.status).toBe("vencida");
  });

  it("status invalido -> invalid_status", async () => {
    const { db } = makeFakeDb();
    const result = await updateFaturaStatus(db, "qualquer-id", "nao_existe");
    expect(result).toEqual({ ok: false, error: "invalid_status" });
  });
});

describe("listFaturasComEmpresa", () => {
  it("traz empresaName de cada fatura", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1", name: "Studio Bella" });
    const created = await createFatura(db, { empresaId: emp.id as string, valorCents: 99700 });
    expect(created.ok).toBe(true);

    const list = await listFaturasComEmpresa(db);
    expect(list).toHaveLength(1);
    expect(list[0].empresaName).toBe("Studio Bella");
    expect(list[0].valorCents).toBe(99700); // campos da propria fatura preservados
  });

  it("filtra por status quando informado", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1", name: "Loja X" });
    const aberta = await createFatura(db, {
      empresaId: emp.id as string,
      valorCents: 1000,
      status: "em_aberto",
    });
    const paga = await createFatura(db, {
      empresaId: emp.id as string,
      valorCents: 2000,
      status: "paga",
    });
    expect(aberta.ok).toBe(true);
    expect(paga.ok).toBe(true);

    const apenasPagas = await listFaturasComEmpresa(db, { status: "paga" });
    expect(apenasPagas).toHaveLength(1);
    expect(apenasPagas[0].status).toBe("paga");
    expect(apenasPagas[0].valorCents).toBe(2000);
    expect(apenasPagas[0].empresaName).toBe("Loja X");

    const todas = await listFaturasComEmpresa(db);
    expect(todas).toHaveLength(2); // sem filtro: todas
  });
});

// src/server/assinaturas.test.ts — testes PUROS do repo de assinaturas (sem banco real).
// Fake in-memory table-aware de DbOrTx que interpreta o chain Drizzle usado pelo repo:
//   select({id}).from(empresas|planos).where(eq).limit()              | lookups de empresa/plano
//   insert(assinaturas).values(v).returning()                        | escrita da assinatura
//   update(assinaturas).set(v).where(eq(id)).returning()             | mudar status (carimba instante)
//   select(proj).from(assinaturas).innerJoin(empresas).leftJoin(planos).orderBy(asc) | listAssinaturasComContexto
// Replica o mecanismo de empresas.test.ts / propostas.test.ts (fake, sem Docker/Postgres),
// estendido com leftJoin (planoName pode ser null) para a tela de cobranca.
import { describe, expect, it } from "vitest";
import { assinaturas, empresas, planos } from "@/db/schema";
import {
  createAssinatura,
  listAssinaturasComContexto,
  updateAssinaturaStatus,
} from "./assinaturas";
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
  planos: keyMap(planos as unknown as Record<string, unknown>),
  assinaturas: keyMap(assinaturas as unknown as Record<string, unknown>),
};

type Row = Record<string, unknown>;
type TableName = "empresas" | "planos" | "assinaturas";

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
  if (table === planos) return "planos";
  if (table === assinaturas) return "assinaturas";
  throw new Error("tabela desconhecida no fake");
}

// Defaults por tabela (colunas com default no schema que o repo nao informa no insert).
function withDefaults(table: string, values: Row, id: string): Row {
  const base: Row = { id, createdAt: new Date(), updatedAt: new Date() };
  if (table === "assinaturas") {
    return {
      status: "pendente",
      name: null,
      dataInicio: null,
      proximoVencimento: null,
      canceladaEm: null,
      pausadaEm: null,
      gatewaySubscriptionId: null,
      planoId: null,
      ...base,
      ...values,
    };
  }
  return { ...base, ...values };
}

function makeFakeDb() {
  const store: Record<string, Row[]> = { empresas: [], planos: [], assinaturas: [] };
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
          // Caminho 2: select com join(s) (listAssinaturasComContexto).
          // innerJoin exige match; leftJoin permite null. Materializa no orderBy/then.
          const joins: { table: unknown; on: unknown; kind: "inner" | "left" }[] = [];
          const joinResult = (): Row[] => {
            const out: Row[] = [];
            for (const base of store[baseName]) {
              const joined: Row = { [baseName]: base };
              let dropped = false;
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
                if (!match && j.kind === "inner") {
                  dropped = true;
                  break;
                }
                joined[jName] = match ?? null;
              }
              if (!dropped) out.push(joined);
            }
            return out;
          };
          const project = (rows: Row[]): Row[] =>
            rows.map((joined) => {
              const proj: Row = {};
              for (const [alias, col] of Object.entries(projection ?? {})) {
                // Coluna inteira da tabela (ex: assinatura: assinaturas) -> objeto da tabela.
                const isWholeTable = col === assinaturas || col === empresas || col === planos;
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
              joins.push({ table: joinTable, on, kind: "inner" });
              return joinChain;
            },
            leftJoin(joinTable: unknown, on: unknown) {
              joins.push({ table: joinTable, on, kind: "left" });
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
              joins.push({ table: joinTable, on, kind: "inner" });
              return joinChain;
            },
            leftJoin(joinTable: unknown, on: unknown) {
              joins.push({ table: joinTable, on, kind: "left" });
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

function seedPlano(store: Record<string, Row[]>, over: Row = {}): Row {
  const plano: Row = {
    id: `planos-seed-${store.planos.length + 1}`,
    name: "Plano Seed",
    precoMensalCents: 99700,
    ciclo: "mensal",
    ativo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
  store.planos.push(plano);
  return plano;
}

describe("createAssinatura — happy path", () => {
  it("usa o valorMensalCents do input quando informado", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });

    const result = await createAssinatura(db, {
      empresaId: emp.id as string,
      valorMensalCents: 49700,
      status: "ativo",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.assinaturas).toHaveLength(1);
    expect(result.assinatura.valorMensalCents).toBe(49700);
    expect(result.assinatura.status).toBe("ativo");
    expect(result.assinatura.empresaId).toBe("emp-1");
  });

  it("copia precoMensalCents do plano quando valorMensalCents ausente (snapshot do MRR)", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const plano = seedPlano(store, { id: "plano-1", precoMensalCents: 99700 });

    const result = await createAssinatura(db, {
      empresaId: emp.id as string,
      planoId: plano.id as string,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assinatura.valorMensalCents).toBe(99700); // snapshot copiado do plano
    expect(result.assinatura.planoId).toBe("plano-1");
    expect(result.assinatura.status).toBe("pendente"); // default do schema
  });
});

describe("createAssinatura — erros", () => {
  it("empresa inexistente -> empresa_not_found", async () => {
    const { db, store } = makeFakeDb();
    const result = await createAssinatura(db, {
      empresaId: "nao-existe",
      valorMensalCents: 1000,
    });
    expect(result).toEqual({ ok: false, error: "empresa_not_found" });
    expect(store.assinaturas).toHaveLength(0);
  });

  it("plano inexistente -> plano_not_found", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const result = await createAssinatura(db, {
      empresaId: emp.id as string,
      planoId: "plano-fantasma",
    });
    expect(result).toEqual({ ok: false, error: "plano_not_found" });
    expect(store.assinaturas).toHaveLength(0);
  });

  it("sem plano e sem valor -> missing_valor", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const result = await createAssinatura(db, { empresaId: emp.id as string });
    expect(result).toEqual({ ok: false, error: "missing_valor" });
    expect(store.assinaturas).toHaveLength(0);
  });

  it("status invalido -> invalid_status", async () => {
    const { db, store } = makeFakeDb();
    seedEmpresa(store, { id: "emp-1" });
    const result = await createAssinatura(db, {
      empresaId: "emp-1",
      valorMensalCents: 1000,
      status: "nao_existe",
    });
    expect(result).toEqual({ ok: false, error: "invalid_status" });
    expect(store.assinaturas).toHaveLength(0);
  });
});

describe("updateAssinaturaStatus", () => {
  it("cancelado: muda status e carimba canceladaEm", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const created = await createAssinatura(db, {
      empresaId: emp.id as string,
      valorMensalCents: 1000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateAssinaturaStatus(db, created.assinatura.id, "cancelado");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assinatura.status).toBe("cancelado");
    expect(result.assinatura.canceladaEm).toBeInstanceOf(Date); // carimbada no cancelamento
    expect(result.assinatura.pausadaEm).toBeNull();
  });

  it("pausado: muda status e carimba pausadaEm", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const created = await createAssinatura(db, {
      empresaId: emp.id as string,
      valorMensalCents: 1000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateAssinaturaStatus(db, created.assinatura.id, "pausado");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assinatura.status).toBe("pausado");
    expect(result.assinatura.pausadaEm).toBeInstanceOf(Date); // carimbada na pausa
    expect(result.assinatura.canceladaEm).toBeNull();
  });

  it("status invalido -> invalid_status", async () => {
    const { db } = makeFakeDb();
    const result = await updateAssinaturaStatus(db, "qualquer-id", "encerrado");
    expect(result).toEqual({ ok: false, error: "invalid_status" });
  });

  it("assinatura inexistente -> not_found", async () => {
    const { db } = makeFakeDb();
    const result = await updateAssinaturaStatus(db, "nao-existe", "ativo");
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("listAssinaturasComContexto", () => {
  it("traz empresaName e planoName de cada assinatura", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1", name: "Studio Bella" });
    const plano = seedPlano(store, { id: "plano-1", name: "Pro" });
    const created = await createAssinatura(db, {
      empresaId: emp.id as string,
      planoId: plano.id as string,
      valorMensalCents: 99700,
    });
    expect(created.ok).toBe(true);

    const list = await listAssinaturasComContexto(db);
    expect(list).toHaveLength(1);
    expect(list[0].empresaName).toBe("Studio Bella");
    expect(list[0].planoName).toBe("Pro");
    expect(list[0].valorMensalCents).toBe(99700); // campos da propria assinatura preservados
  });

  it("planoName fica null quando a assinatura nao tem plano (leftJoin)", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1", name: "Loja X" });
    const created = await createAssinatura(db, {
      empresaId: emp.id as string,
      valorMensalCents: 30000,
    });
    expect(created.ok).toBe(true);

    const list = await listAssinaturasComContexto(db);
    expect(list).toHaveLength(1);
    expect(list[0].empresaName).toBe("Loja X");
    expect(list[0].planoName).toBeNull(); // sem plano vinculado
  });
});

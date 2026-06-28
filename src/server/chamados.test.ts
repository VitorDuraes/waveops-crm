// src/server/chamados.test.ts — testes PUROS do repo de chamados (suporte), sem banco real.
// Fake in-memory table-aware de DbOrTx que interpreta o chain Drizzle usado pelo repo:
//   select({id}).from(empresas).where(eq).limit()                              | lookup de empresa
//   insert(chamados).values(v).returning()                                     | abertura do chamado
//   update(chamados).set(v).where(eq(id)).returning()                          | mudanca de status
//   select(proj).from(chamados).innerJoin(empresas).where(where?).orderBy(...) | listChamadosComEmpresa
// Replica o mecanismo de empresas.test.ts / faturas.test.ts (fake, sem Docker/Postgres),
// com where() pos-innerJoin (filtro opcional por status na tela de chamados).
import { describe, expect, it } from "vitest";
import { chamados, empresas } from "@/db/schema";
import {
  createChamado,
  listChamadosComEmpresa,
  updateChamadoStatus,
} from "./chamados";
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
  chamados: keyMap(chamados as unknown as Record<string, unknown>),
};

type Row = Record<string, unknown>;
type TableName = "empresas" | "chamados";

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
  if (table === chamados) return "chamados";
  throw new Error("tabela desconhecida no fake");
}

// Defaults por tabela (colunas com default no schema que o repo nao informa no insert).
function withDefaults(table: string, values: Row, id: string): Row {
  const base: Row = { id, createdAt: new Date(), updatedAt: new Date() };
  if (table === "chamados") {
    return {
      prioridade: "media",
      status: "aberto",
      descricao: null,
      trelloCardId: null,
      ...base,
      ...values,
    };
  }
  return { ...base, ...values };
}

function makeFakeDb() {
  const store: Record<string, Row[]> = { empresas: [], chamados: [] };
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
          // Caminho 2: select com innerJoin (listChamadosComEmpresa), com where opcional pos-join.
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
                // Coluna inteira da tabela (ex: chamado: chamados) -> objeto da tabela.
                const isWholeTable = col === chamados || col === empresas;
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

describe("createChamado — happy path", () => {
  it("cria chamado com prioridade default media quando ausente", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });

    const result = await createChamado(db, {
      empresaId: emp.id as string,
      titulo: "  Bug no disparo  ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.chamados).toHaveLength(1);
    expect(result.chamado.empresaId).toBe("emp-1");
    expect(result.chamado.titulo).toBe("Bug no disparo"); // trim aplicado
    expect(result.chamado.prioridade).toBe("media"); // default
    expect(result.chamado.status).toBe("aberto"); // default do schema
    expect(result.chamado.descricao).toBeNull();
  });

  it("respeita prioridade e descricao informadas", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const result = await createChamado(db, {
      empresaId: emp.id as string,
      titulo: "Integracao caiu",
      descricao: "  webhook 500  ",
      prioridade: "alta",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chamado.prioridade).toBe("alta");
    expect(result.chamado.descricao).toBe("webhook 500"); // trim aplicado
  });
});

describe("createChamado — erros", () => {
  it("sem titulo -> missing_fields", async () => {
    const { db, store } = makeFakeDb();
    seedEmpresa(store, { id: "emp-1" });
    const result = await createChamado(db, { empresaId: "emp-1", titulo: "   " });
    expect(result).toEqual({ ok: false, error: "missing_fields" });
    expect(store.chamados).toHaveLength(0);
  });

  it("sem empresaId -> missing_fields", async () => {
    const { db } = makeFakeDb();
    const result = await createChamado(db, { empresaId: "", titulo: "Algo" });
    expect(result).toEqual({ ok: false, error: "missing_fields" });
  });

  it("prioridade invalida -> invalid_prioridade (nao consulta empresa)", async () => {
    const { db, store } = makeFakeDb();
    const result = await createChamado(db, {
      empresaId: "emp-1",
      titulo: "Algo",
      prioridade: "urgentissima",
    });
    expect(result).toEqual({ ok: false, error: "invalid_prioridade" });
    expect(store.chamados).toHaveLength(0);
  });

  it("empresa inexistente -> empresa_not_found", async () => {
    const { db, store } = makeFakeDb();
    const result = await createChamado(db, { empresaId: "nao-existe", titulo: "Algo" });
    expect(result).toEqual({ ok: false, error: "empresa_not_found" });
    expect(store.chamados).toHaveLength(0);
  });
});

describe("updateChamadoStatus", () => {
  it("muda status com sucesso", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1" });
    const created = await createChamado(db, { empresaId: emp.id as string, titulo: "Algo" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateChamadoStatus(db, created.chamado.id, "em_andamento");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chamado.status).toBe("em_andamento");
  });

  it("status invalido -> invalid_status (nao consulta tabela)", async () => {
    const { db } = makeFakeDb();
    const result = await updateChamadoStatus(db, "qualquer-id", "nao_existe");
    expect(result).toEqual({ ok: false, error: "invalid_status" });
  });

  it("chamado inexistente (status valido) -> not_found", async () => {
    const { db } = makeFakeDb();
    const result = await updateChamadoStatus(db, "nao-existe", "resolvido");
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("listChamadosComEmpresa", () => {
  it("traz empresaName de cada chamado", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1", name: "Studio Bella" });
    const created = await createChamado(db, {
      empresaId: emp.id as string,
      titulo: "Bug no disparo",
    });
    expect(created.ok).toBe(true);

    const list = await listChamadosComEmpresa(db);
    expect(list).toHaveLength(1);
    expect(list[0].empresaName).toBe("Studio Bella");
    expect(list[0].titulo).toBe("Bug no disparo"); // campos do proprio chamado preservados
  });

  it("filtra por status quando informado", async () => {
    const { db, store } = makeFakeDb();
    const emp = seedEmpresa(store, { id: "emp-1", name: "Loja X" });
    const aberto = await createChamado(db, { empresaId: emp.id as string, titulo: "Aberto" });
    const created2 = await createChamado(db, { empresaId: emp.id as string, titulo: "Resolvido" });
    expect(aberto.ok).toBe(true);
    expect(created2.ok).toBe(true);
    if (!created2.ok) return;
    // move o segundo chamado para resolvido.
    await updateChamadoStatus(db, created2.chamado.id, "resolvido");

    const apenasResolvidos = await listChamadosComEmpresa(db, { status: "resolvido" });
    expect(apenasResolvidos).toHaveLength(1);
    expect(apenasResolvidos[0].status).toBe("resolvido");
    expect(apenasResolvidos[0].titulo).toBe("Resolvido");
    expect(apenasResolvidos[0].empresaName).toBe("Loja X");

    const todos = await listChamadosComEmpresa(db);
    expect(todos).toHaveLength(2); // sem filtro: todos
  });
});

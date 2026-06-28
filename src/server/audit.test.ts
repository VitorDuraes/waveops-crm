// src/server/audit.test.ts — testes PUROS do repo de auditoria (sem banco real).
// Fake in-memory table-aware de DbOrTx que interpreta o chain Drizzle usado pelo repo:
//   insert(auditLog).values(v)                              | append-only (sem .returning, awaited)
//   select().from(auditLog).where(and(eq,eq)).orderBy(desc).limit()  | timeline por alvo
//   select({id,name}).from(users).where(inArray(id, ids))   | nomes dos autores (awaited)
// Replica o mecanismo de empresas.test.ts / ingest.test.ts (fake, sem Docker/Postgres).
import { describe, expect, it } from "vitest";
import { auditLog, users } from "@/db/schema";
import { getActorNames, listAuditByTarget, recordAudit } from "./audit";
import type { DbOrTx } from "./types";

function keyMap(table: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(table)
      .filter(([, col]) => col && typeof col === "object" && "name" in (col as object))
      .map(([key, col]) => [(col as { name?: string }).name ?? key, key]),
  );
}

const KEYS = {
  audit_log: keyMap(auditLog as unknown as Record<string, unknown>),
  users: keyMap(users as unknown as Record<string, unknown>),
};

type Row = Record<string, unknown>;

// Avalia uma condicao Drizzle (SQL) contra um row. Suporta eq, and e inArray.
function matches(condition: unknown, row: Row, keys: Record<string, string>): boolean {
  const chunks = (condition as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return true;

  const nested = chunks.filter(
    (c) => (c as { constructor?: { name?: string } })?.constructor?.name === "SQL",
  );
  if (nested.length > 0) return nested.every((n) => matches(n, row, keys));

  let columnName: string | undefined;
  const params: unknown[] = [];
  let arrayValues: unknown[] | null = null;
  for (const c of chunks) {
    const ctor = (c as { constructor?: { name?: string } })?.constructor?.name;
    if (ctor && ctor.startsWith("Pg")) columnName = (c as { name?: string }).name;
    else if (ctor === "Param") params.push((c as { value?: unknown }).value);
    else if (Array.isArray(c)) {
      arrayValues = (c as unknown[]).map((el) => (el as { value?: unknown }).value);
    }
  }
  if (!columnName) return true;
  const key = keys[columnName] ?? columnName;
  const cell = row[key];
  if (arrayValues) return arrayValues.includes(cell); // inArray
  return cell === params[0]; // eq
}

function tableNameOf(table: unknown): "audit_log" | "users" {
  if (table === auditLog) return "audit_log";
  if (table === users) return "users";
  throw new Error("tabela desconhecida no fake");
}

// Le a coluna e a direcao de um desc(col)/asc(col) do Drizzle e ordena os rows.
// listAuditByTarget pede desc(auditLog.at): o mais recente vem primeiro.
function applyOrder(rows: Row[], order: unknown, keys: Record<string, string>): Row[] {
  const chunks = (order as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return rows;
  let columnName: string | undefined;
  let desc = false;
  for (const c of chunks) {
    const ctor = (c as { constructor?: { name?: string } })?.constructor?.name;
    if (ctor && ctor.startsWith("Pg")) columnName = (c as { name?: string }).name;
    // StringChunk de direcao: value e um array tipo [" desc"] (ou [" asc"]).
    const raw = (c as { value?: unknown })?.value;
    const text = Array.isArray(raw) ? raw.join(" ") : typeof raw === "string" ? raw : "";
    if (text.toLowerCase().includes("desc")) desc = true;
  }
  if (!columnName) return rows;
  const key = keys[columnName] ?? columnName;
  const sorted = [...rows].sort((a, b) => {
    const av = a[key] as number | Date;
    const bv = b[key] as number | Date;
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return desc ? sorted.reverse() : sorted;
}

function makeFakeDb() {
  const store: Record<string, Row[]> = { audit_log: [], users: [] };
  let seq = 0;
  // Garante ordem temporal estavel mesmo com inserts no mesmo milissegundo.
  let clock = 0;

  const db = {
    select(projection?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          const name = tableNameOf(table);
          const project = (rows: Row[]): Row[] => {
            if (!projection) return rows;
            return rows.map((r) => {
              const out: Row = {};
              for (const [alias, col] of Object.entries(projection)) {
                const cName = (col as { name?: string }).name as string;
                out[alias] = r[KEYS[name][cName] ?? cName];
              }
              return out;
            });
          };
          return {
            where(condition: unknown) {
              const rows = () =>
                project(store[name].filter((r) => matches(condition, r, KEYS[name])));
              const query: Record<string, unknown> = {
                orderBy(order: unknown) {
                  const ordered = () => applyOrder(rows(), order, KEYS[name]);
                  return {
                    limit(n: number) {
                      return Promise.resolve(ordered().slice(0, n));
                    },
                    then(onF: (v: Row[]) => unknown, onR?: (e: unknown) => unknown) {
                      return Promise.resolve(ordered()).then(onF, onR);
                    },
                  };
                },
                // getActorNames faz await direto no .where(inArray) (sem orderBy/limit).
                then(onF: (v: Row[]) => unknown, onR?: (e: unknown) => unknown) {
                  return Promise.resolve(rows()).then(onF, onR);
                },
              };
              return query;
            },
          };
        },
      };
    },
    insert(table: unknown) {
      const name = tableNameOf(table);
      return {
        // recordAudit faz await em .values(...) direto, sem .returning().
        values(values: Row) {
          const row: Row = {
            id: `${name}-${++seq}`,
            antes: null,
            depois: null,
            at: new Date(2026, 0, 1, 0, 0, 0, clock++),
            ...values,
          };
          store[name].push(row);
          return Promise.resolve(undefined);
        },
      };
    },
  } as unknown as DbOrTx;

  return { db, store };
}

describe("recordAudit + listAuditByTarget", () => {
  it("grava eventos e lista o mais recente primeiro", async () => {
    const { db, store } = makeFakeDb();

    await recordAudit(db, {
      actorId: "user-1",
      acao: "criar",
      entidade: "oportunidade",
      entidadeId: "op-1",
    });
    await recordAudit(db, {
      actorId: "user-2",
      acao: "mover_estagio",
      entidade: "oportunidade",
      entidadeId: "op-1",
      antes: { stage: "novo_lead" },
      depois: { stage: "contato_feito" },
    });
    // Evento de outro alvo: nao deve aparecer na timeline de op-1.
    await recordAudit(db, { acao: "editar", entidade: "empresa", entidadeId: "e-9" });

    expect(store.audit_log).toHaveLength(3);

    const timeline = await listAuditByTarget(db, "oportunidade", "op-1");
    expect(timeline).toHaveLength(2);
    expect(timeline[0].acao).toBe("mover_estagio"); // mais recente primeiro (desc por at)
    expect(timeline[1].acao).toBe("criar");
    expect(timeline.every((e) => e.entidade === "oportunidade" && e.entidadeId === "op-1")).toBe(
      true,
    );
  });
});

describe("getActorNames", () => {
  it("mapeia ids de autor para nomes, ignorando nulos e repetidos", async () => {
    const { db, store } = makeFakeDb();
    store.users.push(
      { id: "user-1", name: "Vitor" },
      { id: "user-2", name: "Ana" },
      { id: "user-3", name: "Bruno" },
    );

    const map = await getActorNames(db, ["user-1", null, "user-2", "user-1"]);
    expect(map).toEqual({ "user-1": "Vitor", "user-2": "Ana" });
  });

  it("lista vazia (so nulos) retorna objeto vazio sem consultar", async () => {
    const { db } = makeFakeDb();
    const map = await getActorNames(db, [null, null]);
    expect(map).toEqual({});
  });
});

// src/server/tasks.test.ts — testes PUROS do repo de tasks (sem banco real).
// Fake in-memory table-aware de DbOrTx que interpreta o chain Drizzle usado pelo repo:
//   insert(tasks).values(v).returning()                       | escrita da task
//   update(tasks).set(v).where(eq(id)).returning()            | mudar status
//   select().from(tasks).where(and(eq,eq)).orderBy(asc)       | listagem por alvo
// Replica o mecanismo de empresas.test.ts / ingest.test.ts (fake, sem Docker/Postgres).
import { describe, expect, it } from "vitest";
import { tasks } from "@/db/schema";
import { createTask, updateTaskStatus } from "./tasks";
import type { DbOrTx } from "./types";

function keyMap(table: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(table)
      .filter(([, col]) => col && typeof col === "object" && "name" in (col as object))
      .map(([key, col]) => [(col as { name?: string }).name ?? key, key]),
  );
}

const KEYS = { tasks: keyMap(tasks as unknown as Record<string, unknown>) };

type Row = Record<string, unknown>;

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

function tableNameOf(table: unknown): "tasks" {
  if (table === tasks) return "tasks";
  throw new Error("tabela desconhecida no fake");
}

function withDefaults(values: Row, id: string): Row {
  return {
    id,
    status: "aberta",
    dueAt: null,
    autorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  };
}

function makeFakeDb() {
  const store: Record<string, Row[]> = { tasks: [] };
  let seq = 0;

  const db = {
    select() {
      return {
        from(table: unknown) {
          const name = tableNameOf(table);
          return {
            where(condition: unknown) {
              const rows = () => store[name].filter((r) => matches(condition, r, KEYS[name]));
              return {
                orderBy() {
                  return Promise.resolve(rows());
                },
                then(onF: (v: Row[]) => unknown, onR?: (e: unknown) => unknown) {
                  return Promise.resolve(rows()).then(onF, onR);
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
              const row = withDefaults(values, `${name}-${++seq}`);
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

describe("createTask — happy path", () => {
  it("cria task com title, alvo e status default", async () => {
    const { db, store } = makeFakeDb();
    const result = await createTask(db, {
      title: "  ligar para o lead  ",
      targetType: "oportunidade",
      targetId: "op-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.tasks).toHaveLength(1);
    expect(result.task.title).toBe("ligar para o lead"); // trim aplicado
    expect(result.task.targetType).toBe("oportunidade");
    expect(result.task.status).toBe("aberta"); // default do schema
  });
});

describe("createTask — erros", () => {
  it("targetType invalido -> invalid_target_type", async () => {
    const { db, store } = makeFakeDb();
    const result = await createTask(db, {
      title: "tarefa",
      targetType: "contrato",
      targetId: "x-1",
    });
    expect(result).toEqual({ ok: false, error: "invalid_target_type" });
    expect(store.tasks).toHaveLength(0);
  });
});

describe("updateTaskStatus", () => {
  it("muda o status da task", async () => {
    const { db } = makeFakeDb();
    const created = await createTask(db, {
      title: "preparar proposta",
      targetType: "oportunidade",
      targetId: "op-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateTaskStatus(db, created.task.id, "concluida");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.task.status).toBe("concluida");
  });

  it("status invalido -> invalid_status", async () => {
    const { db } = makeFakeDb();
    const result = await updateTaskStatus(db, "qualquer-id", "arquivada");
    expect(result).toEqual({ ok: false, error: "invalid_status" });
  });
});

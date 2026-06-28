// src/server/notes.test.ts — testes PUROS do repo de notes (sem banco real).
// Fake in-memory table-aware de DbOrTx que interpreta o chain Drizzle usado pelo repo:
//   insert(notes).values(v).returning()                       | escrita da nota
//   select().from(notes).where(and(eq,eq)).orderBy(desc)      | listagem por alvo
// Replica o mecanismo de empresas.test.ts / ingest.test.ts (fake, sem Docker/Postgres).
import { describe, expect, it } from "vitest";
import { notes } from "@/db/schema";
import { createNote, listNotesByTarget } from "./notes";
import type { DbOrTx } from "./types";

function keyMap(table: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(table)
      .filter(([, col]) => col && typeof col === "object" && "name" in (col as object))
      .map(([key, col]) => [(col as { name?: string }).name ?? key, key]),
  );
}

const KEYS = { notes: keyMap(notes as unknown as Record<string, unknown>) };

type Row = Record<string, unknown>;

// Avalia uma condicao Drizzle (SQL) contra um row. Suporta eq e and (combinacao de eq).
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

function tableNameOf(table: unknown): "notes" {
  if (table === notes) return "notes";
  throw new Error("tabela desconhecida no fake");
}

function withDefaults(values: Row, id: string): Row {
  return { id, autorId: null, createdAt: new Date(), updatedAt: new Date(), ...values };
}

function makeFakeDb() {
  const store: Record<string, Row[]> = { notes: [] };
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
  } as unknown as DbOrTx;

  return { db, store };
}

describe("createNote — happy path", () => {
  it("cria nota com body, alvo e autor", async () => {
    const { db, store } = makeFakeDb();
    const result = await createNote(db, {
      body: "  cliente pediu retorno na sexta  ",
      targetType: "oportunidade",
      targetId: "op-1",
      autorId: "user-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.notes).toHaveLength(1);
    expect(result.note.body).toBe("cliente pediu retorno na sexta"); // trim aplicado
    expect(result.note.targetType).toBe("oportunidade");
    expect(result.note.targetId).toBe("op-1");
    expect(result.note.autorId).toBe("user-1");
  });
});

describe("createNote — erros", () => {
  it("body vazio -> missing_fields", async () => {
    const { db, store } = makeFakeDb();
    const result = await createNote(db, { body: "   ", targetType: "empresa", targetId: "e-1" });
    expect(result).toEqual({ ok: false, error: "missing_fields" });
    expect(store.notes).toHaveLength(0);
  });

  it("targetType invalido -> invalid_target_type", async () => {
    const { db, store } = makeFakeDb();
    const result = await createNote(db, {
      body: "nota",
      targetType: "fatura",
      targetId: "x-1",
    });
    expect(result).toEqual({ ok: false, error: "invalid_target_type" });
    expect(store.notes).toHaveLength(0);
  });
});

describe("listNotesByTarget", () => {
  it("retorna apenas as notas do alvo (targetType + targetId)", async () => {
    const { db } = makeFakeDb();
    await createNote(db, { body: "nota A1", targetType: "empresa", targetId: "e-1" });
    await createNote(db, { body: "nota A2", targetType: "empresa", targetId: "e-1" });
    await createNote(db, { body: "nota B1", targetType: "empresa", targetId: "e-2" });
    // mesmo id, tipo diferente: nao deve casar.
    await createNote(db, { body: "outra", targetType: "oportunidade", targetId: "e-1" });

    const lista = await listNotesByTarget(db, "empresa", "e-1");
    expect(lista).toHaveLength(2);
    expect(lista.every((n) => n.targetType === "empresa" && n.targetId === "e-1")).toBe(true);
  });
});

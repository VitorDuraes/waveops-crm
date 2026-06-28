// src/server/notes.ts — repositorio de Note (anotacao). Vinculo polimorfico simples
// (targetType, targetId) a qualquer registro. db por DbOrTx. Sem traversal generico.
import { and, desc, eq } from "drizzle-orm";
import { notes } from "@/db/schema";
import { TARGET_TYPE, type TargetType } from "@/lib/validators";
import type { DbOrTx } from "./types";

export type Note = typeof notes.$inferSelect;

const isTargetType = (v: string): v is TargetType =>
  (TARGET_TYPE as readonly string[]).includes(v);

export type CreateNoteInput = {
  body: string;
  targetType: string;
  targetId: string;
  autorId?: string | null;
};

export type CreateNoteResult =
  | { ok: true; note: Note }
  | { ok: false; error: "missing_fields" | "invalid_target_type" };

export async function createNote(db: DbOrTx, input: CreateNoteInput): Promise<CreateNoteResult> {
  const body = input.body?.trim();
  if (!body || !input.targetType || !input.targetId) {
    return { ok: false, error: "missing_fields" };
  }
  if (!isTargetType(input.targetType)) return { ok: false, error: "invalid_target_type" };

  const [created] = await db
    .insert(notes)
    .values({
      body,
      targetType: input.targetType,
      targetId: input.targetId,
      autorId: input.autorId ?? null,
    })
    .returning();

  return { ok: true, note: created };
}

export async function listNotesByTarget(
  db: DbOrTx,
  targetType: string,
  targetId: string,
): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.targetType, targetType), eq(notes.targetId, targetId)))
    .orderBy(desc(notes.createdAt));
}

// src/server/tasks.ts — repositorio de Task (to-do). Vinculo polimorfico simples
// (targetType, targetId). db por DbOrTx. status validado contra TASK_STATUS.
import { and, asc, eq } from "drizzle-orm";
import { tasks } from "@/db/schema";
import { TARGET_TYPE, TASK_STATUS, type TargetType, type TaskStatus } from "@/lib/validators";
import type { DbOrTx } from "./types";

export type Task = typeof tasks.$inferSelect;

const isTargetType = (v: string): v is TargetType =>
  (TARGET_TYPE as readonly string[]).includes(v);
const isTaskStatus = (v: string): v is TaskStatus =>
  (TASK_STATUS as readonly string[]).includes(v);

export type CreateTaskInput = {
  title: string;
  targetType: string;
  targetId: string;
  dueAt?: Date | null;
  autorId?: string | null;
};

export type CreateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; error: "missing_fields" | "invalid_target_type" };

export async function createTask(db: DbOrTx, input: CreateTaskInput): Promise<CreateTaskResult> {
  const title = input.title?.trim();
  if (!title || !input.targetType || !input.targetId) {
    return { ok: false, error: "missing_fields" };
  }
  if (!isTargetType(input.targetType)) return { ok: false, error: "invalid_target_type" };

  const [created] = await db
    .insert(tasks)
    .values({
      title,
      targetType: input.targetType,
      targetId: input.targetId,
      dueAt: input.dueAt ?? null,
      autorId: input.autorId ?? null,
      // status default 'aberta' no schema.
    })
    .returning();

  return { ok: true, task: created };
}

export type UpdateTaskStatusResult =
  | { ok: true; task: Task }
  | { ok: false; error: "not_found" | "invalid_status" };

export async function updateTaskStatus(
  db: DbOrTx,
  id: string,
  to: string,
): Promise<UpdateTaskStatusResult> {
  if (!isTaskStatus(to)) return { ok: false, error: "invalid_status" };

  const [updated] = await db
    .update(tasks)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();

  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true, task: updated };
}

export async function listTasksByTarget(
  db: DbOrTx,
  targetType: string,
  targetId: string,
): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.targetType, targetType), eq(tasks.targetId, targetId)))
    .orderBy(asc(tasks.dueAt));
}

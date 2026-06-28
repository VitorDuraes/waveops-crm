"use server";
// src/server/actions/atividades.actions.ts — Server Actions de Note e Task (atividades).
// Vinculo a qualquer registro via (targetType, targetId). Autor = usuario logado.
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/server/audit";
import * as notesRepo from "@/server/notes";
import * as tasksRepo from "@/server/tasks";

export type AtividadeFormState = { ok: boolean; message: string } | null;

// Revalida a record page do alvo (so empresa e oportunidade tem record page hoje).
function revalidateTarget(targetType: string, targetId: string): void {
  if (targetType === "oportunidade") revalidatePath(`/oportunidades/${targetId}`);
  else if (targetType === "empresa") revalidatePath(`/empresas/${targetId}`);
}

export async function createNoteAction(
  _prev: AtividadeFormState,
  formData: FormData,
): Promise<AtividadeFormState> {
  const user = await requireUser();

  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");

  const result = await notesRepo.createNote(db, {
    body: String(formData.get("body") ?? ""),
    targetType,
    targetId,
    autorId: user.id,
  });
  if (!result.ok) {
    return {
      ok: false,
      message: result.error === "missing_fields" ? "Escreva a nota." : "Tipo de alvo inválido.",
    };
  }

  await recordAudit(db, {
    actorId: user.id,
    acao: "nota",
    entidade: targetType,
    entidadeId: targetId,
    depois: { noteId: result.note.id },
  });

  revalidateTarget(targetType, targetId);
  return { ok: true, message: "Nota adicionada." };
}

export async function createTaskAction(
  _prev: AtividadeFormState,
  formData: FormData,
): Promise<AtividadeFormState> {
  const user = await requireUser();

  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");

  // input type=date (yyyy-mm-dd): ancora ao meio-dia local para nao cair no dia anterior em UTC-3.
  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  const dueIso = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? `${dueRaw}T12:00:00` : dueRaw;
  const due = dueRaw ? new Date(dueIso) : null;
  const dueAt = due && !Number.isNaN(due.getTime()) ? due : null;

  const result = await tasksRepo.createTask(db, {
    title: String(formData.get("title") ?? ""),
    targetType,
    targetId,
    dueAt,
    autorId: user.id,
  });
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.error === "missing_fields" ? "Informe o título da tarefa." : "Tipo de alvo inválido.",
    };
  }

  revalidateTarget(targetType, targetId);
  return { ok: true, message: "Tarefa criada." };
}

export type UpdateTaskStatusResult = { ok: true } | { ok: false; error: string };

export async function updateTaskStatusAction(
  id: string,
  toStatus: string,
  targetType: string,
  targetId: string,
): Promise<UpdateTaskStatusResult> {
  await requireUser();

  const result = await tasksRepo.updateTaskStatus(db, id, toStatus);
  if (!result.ok) return { ok: false, error: result.error };

  revalidateTarget(targetType, targetId);
  return { ok: true };
}

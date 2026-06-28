"use server";
// src/server/actions/chamados.actions.ts — Server Actions de Chamado (suporte).
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/server/audit";
import * as repo from "@/server/chamados";

export type ChamadoFormState = { ok: boolean; message: string } | null;

function mapCreateError(error: string): string {
  switch (error) {
    case "missing_fields":
      return "Informe a empresa e o título do chamado.";
    case "empresa_not_found":
      return "Empresa não encontrada.";
    case "invalid_prioridade":
      return "Prioridade inválida.";
    default:
      return "Não foi possível abrir o chamado.";
  }
}

export async function createChamadoAction(
  _prev: ChamadoFormState,
  formData: FormData,
): Promise<ChamadoFormState> {
  const user = await requireUser();

  const empresaId = String(formData.get("empresaId") ?? "");
  const result = await repo.createChamado(db, {
    empresaId,
    titulo: String(formData.get("titulo") ?? ""),
    descricao: String(formData.get("descricao") ?? "") || null,
    prioridade: String(formData.get("prioridade") ?? "") || null,
  });
  if (!result.ok) return { ok: false, message: mapCreateError(result.error) };

  await recordAudit(db, {
    actorId: user.id,
    acao: "criar",
    entidade: "chamado",
    entidadeId: result.chamado.id,
    depois: { titulo: result.chamado.titulo, prioridade: result.chamado.prioridade },
  });

  revalidatePath("/chamados");
  if (empresaId) revalidatePath(`/empresas/${empresaId}`);
  return { ok: true, message: "Chamado aberto." };
}

export type UpdateChamadoStatusResult = { ok: true } | { ok: false; error: string };

export async function updateChamadoStatusAction(
  id: string,
  toStatus: string,
): Promise<UpdateChamadoStatusResult> {
  const user = await requireUser();

  const before = await repo.getChamadoById(db, id);
  const result = await repo.updateChamadoStatus(db, id, toStatus);
  if (!result.ok) return { ok: false, error: result.error };

  if (before && before.status !== result.chamado.status) {
    await recordAudit(db, {
      actorId: user.id,
      acao: "mudar_status",
      entidade: "chamado",
      entidadeId: id,
      antes: { status: before.status },
      depois: { status: result.chamado.status },
    });
  }

  revalidatePath("/chamados");
  if (result.chamado.empresaId) revalidatePath(`/empresas/${result.chamado.empresaId}`);
  return { ok: true };
}

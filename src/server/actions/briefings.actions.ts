"use server";
// src/server/actions/briefings.actions.ts — Server Action de Briefing (1 por empresa, upsert).
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/server/audit";
import * as repo from "@/server/briefings";

export type BriefingFormState = { ok: boolean; message: string } | null;

function mapError(error: string): string {
  switch (error) {
    case "missing_fields":
      return "Informe a empresa do briefing.";
    case "empresa_not_found":
      return "Empresa não encontrada.";
    default:
      return "Não foi possível salvar o briefing.";
  }
}

export async function upsertBriefingAction(
  _prev: BriefingFormState,
  formData: FormData,
): Promise<BriefingFormState> {
  const user = await requireUser();

  const empresaId = String(formData.get("empresaId") ?? "");
  const result = await repo.upsertBriefing(db, {
    empresaId,
    objetivo: String(formData.get("objetivo") ?? "") || null,
    ferramentaAtual: String(formData.get("ferramentaAtual") ?? "") || null,
    dor: String(formData.get("dor") ?? "") || null,
    volume: String(formData.get("volume") ?? "") || null,
  });
  if (!result.ok) return { ok: false, message: mapError(result.error) };

  await recordAudit(db, {
    actorId: user.id,
    acao: result.criado ? "criar" : "editar",
    entidade: "briefing",
    entidadeId: result.briefing.id,
    depois: { empresaId },
  });

  if (empresaId) revalidatePath(`/empresas/${empresaId}`);
  return { ok: true, message: result.criado ? "Briefing criado." : "Briefing atualizado." };
}

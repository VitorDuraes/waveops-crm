"use server";
// src/server/actions/diagnosticos.actions.ts — Server Actions de Diagnostico (qualificacao).
// Guard de sessao + parse de FormData. Logica no repo. Auditoria append-only no sucesso.
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/server/audit";
import * as repo from "@/server/diagnosticos";

export type DiagnosticoFormState = { ok: boolean; message: string } | null;

function mapError(error: string): string {
  switch (error) {
    case "missing_fields":
      return "Informe a oportunidade do diagnóstico.";
    case "oportunidade_not_found":
      return "Oportunidade não encontrada.";
    case "invalid_fit":
      return "Fit inválido. Use Alto, Médio ou Baixo.";
    default:
      return "Não foi possível salvar o diagnóstico.";
  }
}

export async function createDiagnosticoAction(
  _prev: DiagnosticoFormState,
  formData: FormData,
): Promise<DiagnosticoFormState> {
  const user = await requireUser();

  const oportunidadeId = String(formData.get("oportunidadeId") ?? "");
  const input: repo.CreateDiagnosticoInput = {
    oportunidadeId,
    dor: String(formData.get("dor") ?? "") || null,
    processoAtual: String(formData.get("processoAtual") ?? "") || null,
    ferramentas: String(formData.get("ferramentas") ?? "") || null,
    volume: String(formData.get("volume") ?? "") || null,
    fit: String(formData.get("fit") ?? "") || null,
  };

  const result = await repo.createDiagnostico(db, input);
  if (!result.ok) return { ok: false, message: mapError(result.error) };

  await recordAudit(db, {
    actorId: user.id,
    acao: "criar",
    entidade: "diagnostico",
    entidadeId: result.diagnostico.id,
    depois: { fit: result.diagnostico.fit },
  });

  revalidatePath(`/oportunidades/${oportunidadeId}`);
  return { ok: true, message: "Diagnóstico salvo." };
}

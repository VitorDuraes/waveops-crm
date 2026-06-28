"use server";
// src/server/actions/oportunidades.actions.ts — Server Actions do funil.
// Guard de sessao + validacao/parse antes de escrever. Logica no repo (db injetado).
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { parseBRLToCents } from "@/lib/crm/format";
import { recordAudit } from "@/server/audit";
import * as repo from "@/server/oportunidades";

export type OportunidadeFormState = { ok: boolean; message: string } | null;

function mapCreateError(error: string): string {
  switch (error) {
    case "missing_fields":
      return "Informe o nome da oportunidade e a empresa.";
    case "empresa_not_found":
      return "Empresa não encontrada.";
    case "invalid_probabilidade":
      return "Probabilidade deve ser um número inteiro de 0 a 100.";
    default:
      return "Não foi possível criar a oportunidade.";
  }
}

// Cria uma oportunidade em novo_lead (via useActionState + FormData).
export async function createOportunidadeAction(
  _prev: OportunidadeFormState,
  formData: FormData,
): Promise<OportunidadeFormState> {
  const user = await requireUser();

  const probabilidadeRaw = String(formData.get("probabilidade") ?? "").trim();
  let probabilidade: number | null = null;
  if (probabilidadeRaw) {
    const n = Number(probabilidadeRaw);
    probabilidade = Number.isFinite(n) ? Math.trunc(n) : NaN;
  }

  const input: repo.CreateOportunidadeInput = {
    name: String(formData.get("name") ?? ""),
    empresaId: String(formData.get("empresaId") ?? ""),
    planoPretendido: String(formData.get("planoPretendido") ?? "") || null,
    valorMensalEstimadoCents: parseBRLToCents(String(formData.get("valorMensalEstimado") ?? "")),
    probabilidade,
  };

  const result = await repo.createOportunidade(db, input);
  if (!result.ok) {
    return { ok: false, message: mapCreateError(result.error) };
  }

  await recordAudit(db, {
    actorId: user.id,
    acao: "criar",
    entidade: "oportunidade",
    entidadeId: result.oportunidade.id,
    depois: { name: result.oportunidade.name, stage: result.oportunidade.stage },
  });

  revalidatePath("/funil");
  return { ok: true, message: "Oportunidade criada." };
}

export type MoveOportunidadeResult = { ok: true } | { ok: false; error: string };

// Move uma oportunidade para outro stage (chamada do Kanban via drag-and-drop).
export async function moveOportunidadeAction(
  id: string,
  toStage: string,
): Promise<MoveOportunidadeResult> {
  const user = await requireUser();

  // Captura o stage anterior para a timeline (antes -> depois).
  const before = await repo.getOportunidadeById(db, id);

  const result = await repo.updateStage(db, id, toStage);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (before && before.stage !== result.oportunidade.stage) {
    await recordAudit(db, {
      actorId: user.id,
      acao: "mover_estagio",
      entidade: "oportunidade",
      entidadeId: id,
      antes: { stage: before.stage },
      depois: { stage: result.oportunidade.stage },
    });
  }

  revalidatePath("/funil");
  revalidatePath(`/oportunidades/${id}`);
  return { ok: true };
}

"use server";
// src/server/actions/oportunidades.actions.ts — Server Actions do funil.
// Guard de sessao + validacao/parse antes de escrever. Logica no repo (db injetado).
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { parseBRLToCents } from "@/lib/crm/format";
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
  await requireUser();

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

  revalidatePath("/funil");
  return { ok: true, message: "Oportunidade criada." };
}

export type MoveOportunidadeResult = { ok: true } | { ok: false; error: string };

// Move uma oportunidade para outro stage (chamada do Kanban via drag-and-drop).
export async function moveOportunidadeAction(
  id: string,
  toStage: string,
): Promise<MoveOportunidadeResult> {
  await requireUser();

  const result = await repo.updateStage(db, id, toStage);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath("/funil");
  return { ok: true };
}

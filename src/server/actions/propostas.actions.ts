"use server";
// src/server/actions/propostas.actions.ts — Server Actions de Proposta.
// createPropostaAction (form) e movePropostaAction (kanban por status). Auditoria no sucesso.
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { parseBRLToCents } from "@/lib/crm/format";
import { recordAudit } from "@/server/audit";
import * as repo from "@/server/propostas";

export type PropostaFormState = { ok: boolean; message: string } | null;

function mapCreateError(error: string): string {
  switch (error) {
    case "missing_fields":
      return "Informe o nome da proposta e a oportunidade.";
    case "oportunidade_not_found":
      return "Oportunidade não encontrada.";
    case "invalid_plano":
      return "Plano inválido.";
    default:
      return "Não foi possível criar a proposta.";
  }
}

// Le um input <input type="date"> (yyyy-mm-dd). Vazio ou invalido -> null.
// new Date("yyyy-mm-dd") seria meia-noite UTC e em UTC-3 cairia no dia anterior (off-by-one).
// Ancorar ao meio-dia local preserva o dia escolhido em qualquer fuso do servidor.
function parseDateInput(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createPropostaAction(
  _prev: PropostaFormState,
  formData: FormData,
): Promise<PropostaFormState> {
  const user = await requireUser();

  const oportunidadeId = String(formData.get("oportunidadeId") ?? "");
  const input: repo.CreatePropostaInput = {
    name: String(formData.get("name") ?? ""),
    oportunidadeId,
    plano: String(formData.get("plano") ?? "") || null,
    valorMensalCents: parseBRLToCents(String(formData.get("valorMensal") ?? "")),
    valorSetupCents: parseBRLToCents(String(formData.get("valorSetup") ?? "")),
    escopo: String(formData.get("escopo") ?? "") || null,
    validade: parseDateInput(String(formData.get("validade") ?? "")),
    link: String(formData.get("link") ?? "") || null,
  };

  const result = await repo.createProposta(db, input);
  if (!result.ok) return { ok: false, message: mapCreateError(result.error) };

  await recordAudit(db, {
    actorId: user.id,
    acao: "criar",
    entidade: "proposta",
    entidadeId: result.proposta.id,
    depois: { name: result.proposta.name, status: result.proposta.status },
  });

  revalidatePath("/propostas");
  if (oportunidadeId) revalidatePath(`/oportunidades/${oportunidadeId}`);
  return { ok: true, message: "Proposta criada." };
}

export type MovePropostaResult = { ok: true } | { ok: false; error: string };

// Move a proposta para outro status (chamada do Kanban de propostas).
export async function movePropostaAction(
  id: string,
  toStatus: string,
): Promise<MovePropostaResult> {
  const user = await requireUser();

  const before = await repo.getPropostaById(db, id);

  const result = await repo.updatePropostaStatus(db, id, toStatus);
  if (!result.ok) return { ok: false, error: result.error };

  if (before && before.status !== result.proposta.status) {
    await recordAudit(db, {
      actorId: user.id,
      acao: "mudar_status",
      entidade: "proposta",
      entidadeId: id,
      antes: { status: before.status },
      depois: { status: result.proposta.status },
    });
  }

  revalidatePath("/propostas");
  revalidatePath(`/oportunidades/${result.proposta.oportunidadeId}`);
  return { ok: true };
}

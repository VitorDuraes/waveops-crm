"use server";
// src/server/actions/assinaturas.actions.ts — Server Actions de Assinatura.
// Guard de sessao + parse. Logica no repo. Auditoria + revalida cobranca/dashboards/empresa.
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { parseBRLToCents } from "@/lib/crm/format";
import { recordAudit } from "@/server/audit";
import * as repo from "@/server/assinaturas";

export type AssinaturaFormState = { ok: boolean; message: string } | null;

// input type=date (yyyy-mm-dd): ancora ao meio-dia local para nao cair no dia anterior em UTC-3.
function parseDateInput(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapCreateError(error: string): string {
  switch (error) {
    case "missing_fields":
      return "Informe a empresa da assinatura.";
    case "empresa_not_found":
      return "Empresa não encontrada.";
    case "plano_not_found":
      return "Plano não encontrado.";
    case "invalid_status":
      return "Status inválido.";
    case "missing_valor":
      return "Informe o plano ou o valor mensal da assinatura.";
    case "invalid_valor":
      return "Informe um valor mensal positivo.";
    default:
      return "Não foi possível criar a assinatura.";
  }
}

export async function createAssinaturaAction(
  _prev: AssinaturaFormState,
  formData: FormData,
): Promise<AssinaturaFormState> {
  const user = await requireUser();

  const empresaId = String(formData.get("empresaId") ?? "");
  const input: repo.CreateAssinaturaInput = {
    empresaId,
    planoId: String(formData.get("planoId") ?? "") || null,
    valorMensalCents: parseBRLToCents(String(formData.get("valorMensal") ?? "")),
    status: String(formData.get("status") ?? "") || null,
    dataInicio: parseDateInput(String(formData.get("dataInicio") ?? "")),
    proximoVencimento: parseDateInput(String(formData.get("proximoVencimento") ?? "")),
  };

  const result = await repo.createAssinatura(db, input);
  if (!result.ok) return { ok: false, message: mapCreateError(result.error) };

  await recordAudit(db, {
    actorId: user.id,
    acao: "criar",
    entidade: "assinatura",
    entidadeId: result.assinatura.id,
    depois: { status: result.assinatura.status, valorMensalCents: result.assinatura.valorMensalCents },
  });

  revalidatePath("/cobranca");
  revalidatePath("/dashboards");
  if (empresaId) revalidatePath(`/empresas/${empresaId}`);
  return { ok: true, message: "Assinatura criada." };
}

export type UpdateAssinaturaStatusResult = { ok: true } | { ok: false; error: string };

export async function updateAssinaturaStatusAction(
  id: string,
  toStatus: string,
): Promise<UpdateAssinaturaStatusResult> {
  const user = await requireUser();

  const before = await repo.getAssinaturaById(db, id);
  const result = await repo.updateAssinaturaStatus(db, id, toStatus);
  if (!result.ok) return { ok: false, error: result.error };

  if (before && before.status !== result.assinatura.status) {
    await recordAudit(db, {
      actorId: user.id,
      acao: "mudar_status",
      entidade: "assinatura",
      entidadeId: id,
      antes: { status: before.status },
      depois: { status: result.assinatura.status },
    });
  }

  revalidatePath("/cobranca");
  revalidatePath("/dashboards");
  if (result.assinatura.empresaId) revalidatePath(`/empresas/${result.assinatura.empresaId}`);
  return { ok: true };
}

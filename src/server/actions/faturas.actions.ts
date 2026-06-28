"use server";
// src/server/actions/faturas.actions.ts — Server Actions de Fatura.
// Criar, marcar paga, mudar status. Auditoria + revalida cobranca/dashboards/empresa.
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { parseBRLToCents } from "@/lib/crm/format";
import { recordAudit } from "@/server/audit";
import * as repo from "@/server/faturas";

export type FaturaFormState = { ok: boolean; message: string } | null;

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
      return "Informe a empresa e o valor da fatura.";
    case "empresa_not_found":
      return "Empresa não encontrada.";
    case "invalid_status":
      return "Status inválido.";
    case "invalid_forma":
      return "Forma de pagamento inválida.";
    case "invalid_valor":
      return "Informe um valor positivo para a fatura.";
    case "assinatura_invalida":
      return "Assinatura inválida para esta empresa.";
    default:
      return "Não foi possível criar a fatura.";
  }
}

export async function createFaturaAction(
  _prev: FaturaFormState,
  formData: FormData,
): Promise<FaturaFormState> {
  const user = await requireUser();

  const empresaId = String(formData.get("empresaId") ?? "");
  const valorCents = parseBRLToCents(String(formData.get("valor") ?? ""));
  if (valorCents == null) {
    return { ok: false, message: "Informe a empresa e o valor da fatura." };
  }

  const result = await repo.createFatura(db, {
    empresaId,
    valorCents,
    assinaturaId: String(formData.get("assinaturaId") ?? "") || null,
    vencimento: parseDateInput(String(formData.get("vencimento") ?? "")),
    formaPagamento: String(formData.get("formaPagamento") ?? "") || null,
    status: String(formData.get("status") ?? "") || null,
  });
  if (!result.ok) return { ok: false, message: mapCreateError(result.error) };

  await recordAudit(db, {
    actorId: user.id,
    acao: "criar",
    entidade: "fatura",
    entidadeId: result.fatura.id,
    depois: { status: result.fatura.status, valorCents: result.fatura.valorCents },
  });

  revalidatePath("/cobranca");
  revalidatePath("/dashboards");
  if (empresaId) revalidatePath(`/empresas/${empresaId}`);
  return { ok: true, message: "Fatura criada." };
}

export type FaturaActionResult = { ok: true } | { ok: false; error: string };

export async function marcarFaturaPagaAction(id: string): Promise<FaturaActionResult> {
  const user = await requireUser();

  const before = await repo.getFaturaById(db, id);
  const result = await repo.marcarFaturaPaga(db, id);
  if (!result.ok) return { ok: false, error: result.error };

  if (before && before.status !== "paga") {
    await recordAudit(db, {
      actorId: user.id,
      acao: "mudar_status",
      entidade: "fatura",
      entidadeId: id,
      antes: { status: before.status },
      depois: { status: "paga" },
    });
  }

  revalidatePath("/cobranca");
  revalidatePath("/dashboards");
  if (result.fatura.empresaId) revalidatePath(`/empresas/${result.fatura.empresaId}`);
  return { ok: true };
}

export async function updateFaturaStatusAction(
  id: string,
  toStatus: string,
): Promise<FaturaActionResult> {
  const user = await requireUser();

  const before = await repo.getFaturaById(db, id);
  const result = await repo.updateFaturaStatus(db, id, toStatus);
  if (!result.ok) return { ok: false, error: result.error };

  if (before && before.status !== result.fatura.status) {
    await recordAudit(db, {
      actorId: user.id,
      acao: "mudar_status",
      entidade: "fatura",
      entidadeId: id,
      antes: { status: before.status },
      depois: { status: result.fatura.status },
    });
  }

  revalidatePath("/cobranca");
  revalidatePath("/dashboards");
  if (result.fatura.empresaId) revalidatePath(`/empresas/${result.fatura.empresaId}`);
  return { ok: true };
}

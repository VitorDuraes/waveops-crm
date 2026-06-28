// src/server/ingest.ts — orquestracao da INGESTAO de lead externo (WaveOps Prospect -> CRM).
// Funcao pura: recebe `db` por injecao (DbOrTx), no mesmo padrao dos repos. Sem segredo aqui
// (a auth do endpoint vive no route handler). Reusa createEmpresa (dedup), createPessoa e
// createOportunidade. Idempotente: a empresa dedupa por documento/telefone; a oportunidade
// nao duplica enquanto houver uma "aberta" (qualquer stage exceto ganho/perdido) para a empresa.
import { and, eq, notInArray } from "drizzle-orm";
import { oportunidades } from "@/db/schema";
import { mapSegmento } from "@/lib/crm/segmento";
import { createEmpresa } from "./empresas";
import { createOportunidade } from "./oportunidades";
import { createPessoa } from "./pessoas";
import type { DbOrTx } from "./types";

// Stages que contam como "fechado": uma oportunidade nesses NAO bloqueia criar outra.
const CLOSED_STAGES = ["ganho", "perdido"] as const;

// Origem default de um lead que veio do Prospect (prospeccao outbound).
const DEFAULT_ORIGEM = "outbound";

export type IngestLeadInput = {
  companyName: string;
  document?: string | null;
  phone?: string | null;
  segment?: string | null;
  origem?: string | null;
  website?: string | null;
  contactName?: string | null;
  opportunityName?: string | null;
  planoPretendido?: string | null;
  valorMensalEstimadoCents?: number | null;
};

export type IngestLeadResult =
  | {
      ok: true;
      empresaId: string;
      oportunidadeId: string;
      pessoaId: string | null;
      dedupedEmpresa: boolean;
      dedupedOportunidade: boolean;
    }
  | { ok: false; error: "missing_company_name" | "empresa_failed" | "oportunidade_failed" };

/**
 * Ingere um lead externo: faz upsert da Empresa (status lead, origem do lead) e garante
 * UMA oportunidade aberta no funil (stage novo_lead). Cria a Pessoa de contato se houver nome.
 * Retorna os ids e as flags de dedup para o chamador (route handler) responder ao Prospect.
 */
export async function ingestLead(db: DbOrTx, input: IngestLeadInput): Promise<IngestLeadResult> {
  const companyName = input.companyName?.trim();
  if (!companyName) return { ok: false, error: "missing_company_name" };

  // 1) Upsert da empresa (createEmpresa ja dedup por documento/telefone normalizados).
  const empresaResult = await createEmpresa(db, {
    name: companyName,
    documento: input.document ?? null,
    telefone: input.phone ?? null,
    website: input.website ?? null,
    segmento: mapSegmento(input.segment),
    origemDoLead: input.origem?.trim() || DEFAULT_ORIGEM,
    statusDoCliente: "lead",
  });
  if (!empresaResult.ok) return { ok: false, error: "empresa_failed" };

  const empresaId = empresaResult.empresa.id;
  const dedupedEmpresa = empresaResult.deduped;

  // 2) Pessoa de contato (opcional). Sem contactName, nao cria.
  let pessoaId: string | null = null;
  const contactName = input.contactName?.trim();
  if (contactName) {
    const { firstName, lastName } = splitName(contactName);
    const pessoaResult = await createPessoa(db, {
      firstName,
      lastName,
      phone: input.phone ?? null,
      empresaId,
    });
    if (pessoaResult.ok) pessoaId = pessoaResult.pessoa.id;
  }

  // 3) Oportunidade. Idempotencia: se ja existe uma aberta para a empresa, reusa.
  const existingOpen = await findOpenOportunidade(db, empresaId);
  if (existingOpen) {
    return {
      ok: true,
      empresaId,
      oportunidadeId: existingOpen,
      pessoaId,
      dedupedEmpresa,
      dedupedOportunidade: true,
    };
  }

  const oportunidadeResult = await createOportunidade(db, {
    name: input.opportunityName?.trim() || companyName,
    empresaId,
    planoPretendido: input.planoPretendido ?? null,
    valorMensalEstimadoCents: input.valorMensalEstimadoCents ?? null,
  });
  if (!oportunidadeResult.ok) return { ok: false, error: "oportunidade_failed" };

  return {
    ok: true,
    empresaId,
    oportunidadeId: oportunidadeResult.oportunidade.id,
    pessoaId,
    dedupedEmpresa,
    dedupedOportunidade: false,
  };
}

// Acha o id da PRIMEIRA oportunidade ABERTA da empresa (stage != ganho/perdido). null se nenhuma.
async function findOpenOportunidade(db: DbOrTx, empresaId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: oportunidades.id })
    .from(oportunidades)
    .where(
      and(
        eq(oportunidades.empresaId, empresaId),
        notInArray(oportunidades.stage, CLOSED_STAGES as unknown as string[]),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

// Quebra um nome de contato em first/last. Um token unico vira firstName e lastName fica null.
function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts.shift() ?? fullName;
  const lastName = parts.length ? parts.join(" ") : null;
  return { firstName, lastName };
}

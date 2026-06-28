// src/server/propostas.ts — repositorio de Proposta comercial. db por DbOrTx.
// empresaId derivado da oportunidade. plano e status validados (PLANO, STATUS_PROPOSTA).
import { asc, desc, eq } from "drizzle-orm";
import { empresas, oportunidades, propostas } from "@/db/schema";
import { PLANO, STATUS_PROPOSTA, type Plano, type StatusProposta } from "@/lib/validators";
import { safeExternalUrl } from "@/lib/crm/url";
import type { DbOrTx } from "./types";

export type Proposta = typeof propostas.$inferSelect;

// Proposta enriquecida para o card do Kanban de propostas.
export type PropostaComContexto = Proposta & { empresaName: string; oportunidadeName: string };

const isPlano = (v: string): v is Plano => (PLANO as readonly string[]).includes(v);
const isStatusProposta = (v: string): v is StatusProposta =>
  (STATUS_PROPOSTA as readonly string[]).includes(v);

// ---------- CREATE ----------
export type CreatePropostaInput = {
  name: string;
  oportunidadeId: string;
  plano?: string | null;
  valorMensalCents?: number | null;
  valorSetupCents?: number | null;
  escopo?: string | null;
  validade?: Date | null;
  link?: string | null;
};

export type CreatePropostaResult =
  | { ok: true; proposta: Proposta }
  | { ok: false; error: "missing_fields" | "oportunidade_not_found" | "invalid_plano" };

export async function createProposta(
  db: DbOrTx,
  input: CreatePropostaInput,
): Promise<CreatePropostaResult> {
  const name = input.name?.trim();
  if (!name || !input.oportunidadeId) return { ok: false, error: "missing_fields" };

  const plano = input.plano?.trim() || null;
  if (plano && !isPlano(plano)) return { ok: false, error: "invalid_plano" };

  const [opp] = await db
    .select({ id: oportunidades.id, empresaId: oportunidades.empresaId })
    .from(oportunidades)
    .where(eq(oportunidades.id, input.oportunidadeId))
    .limit(1);
  if (!opp) return { ok: false, error: "oportunidade_not_found" };

  const [created] = await db
    .insert(propostas)
    .values({
      name,
      oportunidadeId: opp.id,
      empresaId: opp.empresaId,
      plano,
      valorMensalCents: input.valorMensalCents ?? null,
      valorSetupCents: input.valorSetupCents ?? null,
      escopo: input.escopo?.trim() || null,
      validade: input.validade ?? null,
      link: safeExternalUrl(input.link),
      // status default 'rascunho' no schema.
    })
    .returning();

  return { ok: true, proposta: created };
}

// ---------- UPDATE STATUS (mover no kanban de propostas) ----------
export type UpdatePropostaStatusResult =
  | { ok: true; proposta: Proposta }
  | { ok: false; error: "not_found" | "invalid_status" };

export async function updatePropostaStatus(
  db: DbOrTx,
  id: string,
  to: string,
): Promise<UpdatePropostaStatusResult> {
  if (!isStatusProposta(to)) return { ok: false, error: "invalid_status" };

  // Ao enviar, carimba dataEnvio se ainda nao houver.
  const set: Record<string, unknown> = { status: to, updatedAt: new Date() };
  if (to === "enviada") {
    const [current] = await db
      .select({ dataEnvio: propostas.dataEnvio })
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);
    if (current && current.dataEnvio == null) set.dataEnvio = new Date();
  }

  const [updated] = await db.update(propostas).set(set).where(eq(propostas.id, id)).returning();
  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true, proposta: updated };
}

// ---------- READ ----------
export async function getPropostaById(db: DbOrTx, id: string): Promise<Proposta | null> {
  const [row] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);
  return row ?? null;
}

export async function listPropostasByOportunidade(
  db: DbOrTx,
  oportunidadeId: string,
): Promise<Proposta[]> {
  return db
    .select()
    .from(propostas)
    .where(eq(propostas.oportunidadeId, oportunidadeId))
    .orderBy(desc(propostas.createdAt));
}

// Propostas de uma empresa (para a record page da Empresa). Mais recente primeiro.
export async function listPropostasByEmpresa(
  db: DbOrTx,
  empresaId: string,
): Promise<Proposta[]> {
  return db
    .select()
    .from(propostas)
    .where(eq(propostas.empresaId, empresaId))
    .orderBy(desc(propostas.createdAt));
}

// Todas as propostas com contexto, para o Kanban por status.
export async function listPropostasComContexto(db: DbOrTx): Promise<PropostaComContexto[]> {
  const rows = await db
    .select({
      proposta: propostas,
      empresaName: empresas.name,
      oportunidadeName: oportunidades.name,
    })
    .from(propostas)
    .innerJoin(empresas, eq(propostas.empresaId, empresas.id))
    .innerJoin(oportunidades, eq(propostas.oportunidadeId, oportunidades.id))
    .orderBy(asc(propostas.createdAt));

  return rows.map((r) => ({
    ...r.proposta,
    empresaName: r.empresaName,
    oportunidadeName: r.oportunidadeName,
  }));
}

// src/server/oportunidades.ts — repositorio de oportunidades (funil). db injetado por DbOrTx.
// Stage default = novo_lead. updateStage move no Kanban. Validacao + retorno discriminado.
import { asc, eq } from "drizzle-orm";
import { empresas, oportunidades } from "@/db/schema";
import { DEFAULT_STAGE, isStage } from "@/lib/crm/stage";
import { type Stage } from "@/lib/validators";
import type { DbOrTx } from "./types";

export type Oportunidade = typeof oportunidades.$inferSelect;

// Oportunidade enriquecida com o nome da empresa, para o card do Kanban.
export type OportunidadeComEmpresa = Oportunidade & { empresaName: string };

// ---------- CREATE ----------
export type CreateOportunidadeInput = {
  name: string;
  empresaId: string;
  planoPretendido?: string | null;
  valorMensalEstimadoCents?: number | null;
  probabilidade?: number | null;
};

export type CreateOportunidadeResult =
  | { ok: true; oportunidade: Oportunidade }
  | { ok: false; error: "missing_fields" | "empresa_not_found" | "invalid_probabilidade" };

export async function createOportunidade(
  db: DbOrTx,
  input: CreateOportunidadeInput,
): Promise<CreateOportunidadeResult> {
  const name = input.name?.trim();
  if (!name || !input.empresaId) return { ok: false, error: "missing_fields" };

  if (input.probabilidade != null) {
    if (
      !Number.isInteger(input.probabilidade) ||
      input.probabilidade < 0 ||
      input.probabilidade > 100
    ) {
      return { ok: false, error: "invalid_probabilidade" };
    }
  }

  // Empresa e obrigatoria e precisa existir (FK cascade no schema).
  const [empresa] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(eq(empresas.id, input.empresaId))
    .limit(1);
  if (!empresa) return { ok: false, error: "empresa_not_found" };

  const [created] = await db
    .insert(oportunidades)
    .values({
      name,
      empresaId: input.empresaId,
      stage: DEFAULT_STAGE,
      planoPretendido: input.planoPretendido?.trim() || null,
      valorMensalEstimadoCents: input.valorMensalEstimadoCents ?? null,
      probabilidade: input.probabilidade ?? null,
    })
    .returning();

  return { ok: true, oportunidade: created };
}

// ---------- UPDATE STAGE (mover no funil) ----------
export type UpdateStageResult =
  | { ok: true; oportunidade: Oportunidade }
  | { ok: false; error: "not_found" | "invalid_stage" };

export async function updateStage(
  db: DbOrTx,
  id: string,
  to: string,
): Promise<UpdateStageResult> {
  if (!isStage(to)) return { ok: false, error: "invalid_stage" };

  const [updated] = await db
    .update(oportunidades)
    .set({ stage: to, updatedAt: new Date() })
    .where(eq(oportunidades.id, id))
    .returning();

  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true, oportunidade: updated };
}

// ---------- UPDATE (campos gerais) ----------
export type UpdateOportunidadePatch = {
  name?: string;
  planoPretendido?: string | null;
  valorMensalEstimadoCents?: number | null;
  probabilidade?: number | null;
};

export type UpdateOportunidadeResult =
  | { ok: true; oportunidade: Oportunidade }
  | { ok: false; error: "not_found" | "no_changes" | "invalid_probabilidade" };

export async function updateOportunidade(
  db: DbOrTx,
  id: string,
  patch: UpdateOportunidadePatch,
): Promise<UpdateOportunidadeResult> {
  const updates: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name) updates.name = name;
  }
  if (patch.planoPretendido !== undefined) {
    updates.planoPretendido = patch.planoPretendido?.trim() || null;
  }
  if (patch.valorMensalEstimadoCents !== undefined) {
    updates.valorMensalEstimadoCents = patch.valorMensalEstimadoCents;
  }
  if (patch.probabilidade !== undefined) {
    if (patch.probabilidade != null) {
      if (
        !Number.isInteger(patch.probabilidade) ||
        patch.probabilidade < 0 ||
        patch.probabilidade > 100
      ) {
        return { ok: false, error: "invalid_probabilidade" };
      }
    }
    updates.probabilidade = patch.probabilidade;
  }

  if (Object.keys(updates).length === 0) return { ok: false, error: "no_changes" };
  updates.updatedAt = new Date();

  const [updated] = await db.update(oportunidades).set(updates).where(eq(oportunidades.id, id)).returning();
  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true, oportunidade: updated };
}

// ---------- READ ----------
export async function getOportunidadeById(db: DbOrTx, id: string): Promise<Oportunidade | null> {
  const [row] = await db.select().from(oportunidades).where(eq(oportunidades.id, id)).limit(1);
  return row ?? null;
}

/**
 * Lista TODAS as oportunidades com o nome da empresa, para montar o Kanban.
 * Ordena por createdAt asc dentro de cada stage (o agrupamento por coluna e feito
 * na tela via groupByStage de @/lib/crm/stage). Join com empresas pela FK.
 */
export async function listOportunidadesComEmpresa(db: DbOrTx): Promise<OportunidadeComEmpresa[]> {
  const rows = await db
    .select({
      oportunidade: oportunidades,
      empresaName: empresas.name,
    })
    .from(oportunidades)
    .innerJoin(empresas, eq(oportunidades.empresaId, empresas.id))
    .orderBy(asc(oportunidades.createdAt));

  return rows.map((r) => ({ ...r.oportunidade, empresaName: r.empresaName }));
}

// Tipo so para a tela: oportunidades ja agrupadas por stage.
export type { Stage };

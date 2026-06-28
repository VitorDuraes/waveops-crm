// src/server/briefings.ts — repositorio de Briefing (1 por empresa, upsert). db por DbOrTx.
import { eq } from "drizzle-orm";
import { briefings, empresas } from "@/db/schema";
import type { DbOrTx } from "./types";

export type Briefing = typeof briefings.$inferSelect;

export type UpsertBriefingInput = {
  empresaId: string;
  objetivo?: string | null;
  ferramentaAtual?: string | null;
  dor?: string | null;
  volume?: string | null;
};

export type UpsertBriefingResult =
  | { ok: true; briefing: Briefing; criado: boolean }
  | { ok: false; error: "missing_fields" | "empresa_not_found" };

// Idempotente por empresa: se ja existir briefing da empresa, atualiza; senao cria.
export async function upsertBriefing(
  db: DbOrTx,
  input: UpsertBriefingInput,
): Promise<UpsertBriefingResult> {
  if (!input.empresaId) return { ok: false, error: "missing_fields" };

  const [empresa] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(eq(empresas.id, input.empresaId))
    .limit(1);
  if (!empresa) return { ok: false, error: "empresa_not_found" };

  const values = {
    objetivo: input.objetivo?.trim() || null,
    ferramentaAtual: input.ferramentaAtual?.trim() || null,
    dor: input.dor?.trim() || null,
    volume: input.volume?.trim() || null,
  };

  const [existing] = await db
    .select({ id: briefings.id })
    .from(briefings)
    .where(eq(briefings.empresaId, input.empresaId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(briefings)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(briefings.id, existing.id))
      .returning();
    return { ok: true, briefing: updated, criado: false };
  }

  const [created] = await db
    .insert(briefings)
    .values({ empresaId: input.empresaId, ...values })
    .returning();
  return { ok: true, briefing: created, criado: true };
}

export async function getBriefingByEmpresa(db: DbOrTx, empresaId: string): Promise<Briefing | null> {
  const [row] = await db
    .select()
    .from(briefings)
    .where(eq(briefings.empresaId, empresaId))
    .limit(1);
  return row ?? null;
}

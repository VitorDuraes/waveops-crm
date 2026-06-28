// src/server/diagnosticos.ts — repositorio de Diagnostico (qualificacao do deal). db por DbOrTx.
// empresaId e derivado da oportunidade (nunca recebido do cliente). fit validado contra FIT.
import { desc, eq } from "drizzle-orm";
import { diagnosticos, oportunidades } from "@/db/schema";
import { FIT, type Fit } from "@/lib/validators";
import type { DbOrTx } from "./types";

export type Diagnostico = typeof diagnosticos.$inferSelect;

const isFit = (v: string): v is Fit => (FIT as readonly string[]).includes(v);

export type CreateDiagnosticoInput = {
  oportunidadeId: string;
  dor?: string | null;
  processoAtual?: string | null;
  ferramentas?: string | null;
  volume?: string | null;
  fit?: string | null;
};

export type CreateDiagnosticoResult =
  | { ok: true; diagnostico: Diagnostico }
  | { ok: false; error: "missing_fields" | "oportunidade_not_found" | "invalid_fit" };

export async function createDiagnostico(
  db: DbOrTx,
  input: CreateDiagnosticoInput,
): Promise<CreateDiagnosticoResult> {
  if (!input.oportunidadeId) return { ok: false, error: "missing_fields" };

  const fit = input.fit?.trim() || null;
  if (fit && !isFit(fit)) return { ok: false, error: "invalid_fit" };

  // empresaId vem da oportunidade (FK cascade), nunca do cliente.
  const [opp] = await db
    .select({ id: oportunidades.id, empresaId: oportunidades.empresaId })
    .from(oportunidades)
    .where(eq(oportunidades.id, input.oportunidadeId))
    .limit(1);
  if (!opp) return { ok: false, error: "oportunidade_not_found" };

  const [created] = await db
    .insert(diagnosticos)
    .values({
      oportunidadeId: opp.id,
      empresaId: opp.empresaId,
      dor: input.dor?.trim() || null,
      processoAtual: input.processoAtual?.trim() || null,
      ferramentas: input.ferramentas?.trim() || null,
      volume: input.volume?.trim() || null,
      fit,
    })
    .returning();

  return { ok: true, diagnostico: created };
}

export async function listDiagnosticosByOportunidade(
  db: DbOrTx,
  oportunidadeId: string,
): Promise<Diagnostico[]> {
  return db
    .select()
    .from(diagnosticos)
    .where(eq(diagnosticos.oportunidadeId, oportunidadeId))
    .orderBy(desc(diagnosticos.createdAt));
}

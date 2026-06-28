// src/server/planos.ts — repositorio de Plano (catalogo). Somente leitura no MVP (planos seedados).
import { asc, eq } from "drizzle-orm";
import { planos } from "@/db/schema";
import type { DbOrTx } from "./types";

export type Plano = typeof planos.$inferSelect;

export async function listPlanos(db: DbOrTx): Promise<Plano[]> {
  return db.select().from(planos).orderBy(asc(planos.precoMensalCents));
}

export async function listPlanosAtivos(db: DbOrTx): Promise<Plano[]> {
  return db
    .select()
    .from(planos)
    .where(eq(planos.ativo, true))
    .orderBy(asc(planos.precoMensalCents));
}

export async function getPlanoById(db: DbOrTx, id: string): Promise<Plano | null> {
  const [row] = await db.select().from(planos).where(eq(planos.id, id)).limit(1);
  return row ?? null;
}

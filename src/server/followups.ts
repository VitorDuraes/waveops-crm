// src/server/followups.ts — repositorio de Follow-up (regua de cobranca por fatura). db por DbOrTx.
// O disparo real (WhatsApp/e-mail) e fase posterior; aqui ficam o registro e a listagem.
import { asc, eq } from "drizzle-orm";
import { empresas, faturas, followups } from "@/db/schema";
import {
  CANAL_FOLLOWUP,
  TIPO_FOLLOWUP,
  type CanalFollowup,
  type TipoFollowup,
} from "@/lib/validators";
import type { DbOrTx } from "./types";

export type Followup = typeof followups.$inferSelect;

const isTipo = (v: string): v is TipoFollowup => (TIPO_FOLLOWUP as readonly string[]).includes(v);
const isCanal = (v: string): v is CanalFollowup =>
  (CANAL_FOLLOWUP as readonly string[]).includes(v);

export type CreateFollowupInput = {
  empresaId: string;
  faturaId?: string | null;
  tipo: string;
  canal?: string | null;
  mensagem?: string | null;
  agendadoPara?: Date | null;
};

export type CreateFollowupResult =
  | { ok: true; followup: Followup }
  | {
      ok: false;
      error: "missing_fields" | "invalid_tipo" | "invalid_canal" | "empresa_not_found" | "fatura_invalida";
    };

export async function createFollowup(
  db: DbOrTx,
  input: CreateFollowupInput,
): Promise<CreateFollowupResult> {
  if (!input.empresaId || !input.tipo) return { ok: false, error: "missing_fields" };
  if (!isTipo(input.tipo)) return { ok: false, error: "invalid_tipo" };

  const canal = input.canal?.trim() || "whatsapp";
  if (!isCanal(canal)) return { ok: false, error: "invalid_canal" };

  const [empresa] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(eq(empresas.id, input.empresaId))
    .limit(1);
  if (!empresa) return { ok: false, error: "empresa_not_found" };

  // Se vier faturaId, exige que pertenca a MESMA empresa (evita regua apontando para fatura cruzada).
  const faturaId = input.faturaId?.trim() || null;
  if (faturaId) {
    const [fatura] = await db
      .select({ id: faturas.id, empresaId: faturas.empresaId })
      .from(faturas)
      .where(eq(faturas.id, faturaId))
      .limit(1);
    if (!fatura || fatura.empresaId !== input.empresaId) {
      return { ok: false, error: "fatura_invalida" };
    }
  }

  const [created] = await db
    .insert(followups)
    .values({
      empresaId: input.empresaId,
      faturaId,
      tipo: input.tipo,
      canal,
      mensagem: input.mensagem?.trim() || null,
      agendadoPara: input.agendadoPara ?? null,
    })
    .returning();

  return { ok: true, followup: created };
}

export async function listFollowupsByFatura(db: DbOrTx, faturaId: string): Promise<Followup[]> {
  return db
    .select()
    .from(followups)
    .where(eq(followups.faturaId, faturaId))
    .orderBy(asc(followups.agendadoPara));
}

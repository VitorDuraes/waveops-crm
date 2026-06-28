// src/server/chamados.ts — repositorio de Chamado (suporte). db por DbOrTx.
import { asc, desc, eq } from "drizzle-orm";
import { chamados, empresas } from "@/db/schema";
import {
  PRIORIDADE_CHAMADO,
  STATUS_CHAMADO,
  type PrioridadeChamado,
  type StatusChamado,
} from "@/lib/validators";
import type { DbOrTx } from "./types";

export type Chamado = typeof chamados.$inferSelect;
export type ChamadoComEmpresa = Chamado & { empresaName: string };

const isPrioridade = (v: string): v is PrioridadeChamado =>
  (PRIORIDADE_CHAMADO as readonly string[]).includes(v);
const isStatus = (v: string): v is StatusChamado =>
  (STATUS_CHAMADO as readonly string[]).includes(v);

export type CreateChamadoInput = {
  empresaId: string;
  titulo: string;
  descricao?: string | null;
  prioridade?: string | null;
};

export type CreateChamadoResult =
  | { ok: true; chamado: Chamado }
  | { ok: false; error: "missing_fields" | "empresa_not_found" | "invalid_prioridade" };

export async function createChamado(
  db: DbOrTx,
  input: CreateChamadoInput,
): Promise<CreateChamadoResult> {
  const titulo = input.titulo?.trim();
  if (!input.empresaId || !titulo) return { ok: false, error: "missing_fields" };

  let prioridade: PrioridadeChamado = "media";
  const prioridadeRaw = input.prioridade?.trim();
  if (prioridadeRaw) {
    if (!isPrioridade(prioridadeRaw)) return { ok: false, error: "invalid_prioridade" };
    prioridade = prioridadeRaw;
  }

  const [empresa] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(eq(empresas.id, input.empresaId))
    .limit(1);
  if (!empresa) return { ok: false, error: "empresa_not_found" };

  const [created] = await db
    .insert(chamados)
    .values({
      empresaId: input.empresaId,
      titulo,
      descricao: input.descricao?.trim() || null,
      prioridade,
    })
    .returning();

  return { ok: true, chamado: created };
}

export type UpdateChamadoStatusResult =
  | { ok: true; chamado: Chamado }
  | { ok: false; error: "not_found" | "invalid_status" };

export async function updateChamadoStatus(
  db: DbOrTx,
  id: string,
  to: string,
): Promise<UpdateChamadoStatusResult> {
  if (!isStatus(to)) return { ok: false, error: "invalid_status" };

  const [updated] = await db
    .update(chamados)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(chamados.id, id))
    .returning();
  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true, chamado: updated };
}

export async function getChamadoById(db: DbOrTx, id: string): Promise<Chamado | null> {
  const [row] = await db.select().from(chamados).where(eq(chamados.id, id)).limit(1);
  return row ?? null;
}

export async function listChamadosByEmpresa(db: DbOrTx, empresaId: string): Promise<Chamado[]> {
  return db
    .select()
    .from(chamados)
    .where(eq(chamados.empresaId, empresaId))
    .orderBy(desc(chamados.createdAt));
}

export type ListChamadosParams = { status?: StatusChamado };

export async function listChamadosComEmpresa(
  db: DbOrTx,
  params: ListChamadosParams = {},
): Promise<ChamadoComEmpresa[]> {
  const where = params.status ? eq(chamados.status, params.status) : undefined;
  const rows = await db
    .select({ chamado: chamados, empresaName: empresas.name })
    .from(chamados)
    .innerJoin(empresas, eq(chamados.empresaId, empresas.id))
    .where(where)
    .orderBy(asc(chamados.status), desc(chamados.createdAt));

  return rows.map((r) => ({ ...r.chamado, empresaName: r.empresaName }));
}

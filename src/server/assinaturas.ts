// src/server/assinaturas.ts — repositorio de Assinatura (vinculo Empresa<->Plano).
// valorMensalCents e SNAPSHOT (fonte do MRR): se nao vier no input, copia do plano.
// Mudar status para cancelado/pausado carimba o instante. db por DbOrTx.
import { asc, desc, eq } from "drizzle-orm";
import { assinaturas, empresas, planos } from "@/db/schema";
import { STATUS_ASSINATURA, type StatusAssinatura } from "@/lib/validators";
import type { DbOrTx } from "./types";

export type Assinatura = typeof assinaturas.$inferSelect;
export type AssinaturaComContexto = Assinatura & {
  empresaName: string;
  planoName: string | null;
};

const isStatus = (v: string): v is StatusAssinatura =>
  (STATUS_ASSINATURA as readonly string[]).includes(v);

// ---------- CREATE ----------
export type CreateAssinaturaInput = {
  empresaId: string;
  planoId?: string | null;
  // Se ausente e houver plano, usa o preco do plano como snapshot.
  valorMensalCents?: number | null;
  status?: string | null;
  dataInicio?: Date | null;
  proximoVencimento?: Date | null;
  name?: string | null;
};

export type CreateAssinaturaResult =
  | { ok: true; assinatura: Assinatura }
  | {
      ok: false;
      error:
        | "missing_fields"
        | "empresa_not_found"
        | "plano_not_found"
        | "invalid_status"
        | "missing_valor"
        | "invalid_valor";
    };

export async function createAssinatura(
  db: DbOrTx,
  input: CreateAssinaturaInput,
): Promise<CreateAssinaturaResult> {
  if (!input.empresaId) return { ok: false, error: "missing_fields" };

  let status: StatusAssinatura = "pendente";
  const statusRaw = input.status?.trim();
  if (statusRaw) {
    if (!isStatus(statusRaw)) return { ok: false, error: "invalid_status" };
    status = statusRaw;
  }

  const [empresa] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(eq(empresas.id, input.empresaId))
    .limit(1);
  if (!empresa) return { ok: false, error: "empresa_not_found" };

  let valorMensalCents = input.valorMensalCents ?? null;
  const planoId = input.planoId?.trim() || null;
  if (planoId) {
    const [plano] = await db.select().from(planos).where(eq(planos.id, planoId)).limit(1);
    if (!plano) return { ok: false, error: "plano_not_found" };
    if (valorMensalCents == null) valorMensalCents = plano.precoMensalCents;
  }
  if (valorMensalCents == null) return { ok: false, error: "missing_valor" };
  // Dinheiro positivo: valor <= 0 corromperia o MRR (soma dos valorMensalCents das ativas).
  if (!Number.isInteger(valorMensalCents) || valorMensalCents <= 0) {
    return { ok: false, error: "invalid_valor" };
  }

  const [created] = await db
    .insert(assinaturas)
    .values({
      empresaId: input.empresaId,
      planoId,
      valorMensalCents,
      status,
      name: input.name?.trim() || null,
      dataInicio: input.dataInicio ?? null,
      proximoVencimento: input.proximoVencimento ?? null,
    })
    .returning();

  return { ok: true, assinatura: created };
}

// ---------- UPDATE STATUS ----------
export type UpdateAssinaturaStatusResult =
  | { ok: true; assinatura: Assinatura }
  | { ok: false; error: "not_found" | "invalid_status" };

export async function updateAssinaturaStatus(
  db: DbOrTx,
  id: string,
  to: string,
): Promise<UpdateAssinaturaStatusResult> {
  if (!isStatus(to)) return { ok: false, error: "invalid_status" };

  const set: Record<string, unknown> = { status: to, updatedAt: new Date() };
  if (to === "cancelado") set.canceladaEm = new Date();
  if (to === "pausado") set.pausadaEm = new Date();

  const [updated] = await db.update(assinaturas).set(set).where(eq(assinaturas.id, id)).returning();
  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true, assinatura: updated };
}

// ---------- READ ----------
export async function getAssinaturaById(db: DbOrTx, id: string): Promise<Assinatura | null> {
  const [row] = await db.select().from(assinaturas).where(eq(assinaturas.id, id)).limit(1);
  return row ?? null;
}

export async function listAssinaturasByEmpresa(
  db: DbOrTx,
  empresaId: string,
): Promise<Assinatura[]> {
  return db
    .select()
    .from(assinaturas)
    .where(eq(assinaturas.empresaId, empresaId))
    .orderBy(desc(assinaturas.createdAt));
}

// Todas as assinaturas com nome da empresa e do plano (para a tela de cobranca).
export async function listAssinaturasComContexto(db: DbOrTx): Promise<AssinaturaComContexto[]> {
  const rows = await db
    .select({
      assinatura: assinaturas,
      empresaName: empresas.name,
      planoName: planos.name,
    })
    .from(assinaturas)
    .innerJoin(empresas, eq(assinaturas.empresaId, empresas.id))
    .leftJoin(planos, eq(assinaturas.planoId, planos.id))
    .orderBy(asc(assinaturas.status), desc(assinaturas.createdAt));

  return rows.map((r) => ({
    ...r.assinatura,
    empresaName: r.empresaName,
    planoName: r.planoName ?? null,
  }));
}

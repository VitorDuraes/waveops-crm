// src/server/faturas.ts — repositorio de Fatura (cobranca de uma empresa/assinatura). db por DbOrTx.
import { asc, desc, eq } from "drizzle-orm";
import { assinaturas, empresas, faturas } from "@/db/schema";
import { FORMA_PAGAMENTO, STATUS_FATURA, type FormaPagamento, type StatusFatura } from "@/lib/validators";
import type { DbOrTx } from "./types";

export type Fatura = typeof faturas.$inferSelect;
export type FaturaComEmpresa = Fatura & { empresaName: string };

const isStatus = (v: string): v is StatusFatura => (STATUS_FATURA as readonly string[]).includes(v);
const isForma = (v: string): v is FormaPagamento =>
  (FORMA_PAGAMENTO as readonly string[]).includes(v);

// ---------- CREATE ----------
export type CreateFaturaInput = {
  empresaId: string;
  valorCents: number;
  assinaturaId?: string | null;
  vencimento?: Date | null;
  formaPagamento?: string | null;
  status?: string | null;
  name?: string | null;
};

export type CreateFaturaResult =
  | { ok: true; fatura: Fatura }
  | {
      ok: false;
      error:
        | "missing_fields"
        | "empresa_not_found"
        | "invalid_status"
        | "invalid_forma"
        | "invalid_valor"
        | "assinatura_invalida";
    };

export async function createFatura(db: DbOrTx, input: CreateFaturaInput): Promise<CreateFaturaResult> {
  if (!input.empresaId) return { ok: false, error: "missing_fields" };
  // Valor positivo: fatura <= 0 entra nos totais de cobranca e corrompe os dashboards.
  if (!Number.isInteger(input.valorCents) || input.valorCents <= 0) {
    return { ok: false, error: "invalid_valor" };
  }

  let status: StatusFatura = "em_aberto";
  const statusRaw = input.status?.trim();
  if (statusRaw) {
    if (!isStatus(statusRaw)) return { ok: false, error: "invalid_status" };
    status = statusRaw;
  }

  const forma = input.formaPagamento?.trim() || null;
  if (forma && !isForma(forma)) return { ok: false, error: "invalid_forma" };

  const [empresa] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(eq(empresas.id, input.empresaId))
    .limit(1);
  if (!empresa) return { ok: false, error: "empresa_not_found" };

  // Se vier assinaturaId, exige que pertenca a MESMA empresa (evita vinculo cruzado / IDOR).
  const assinaturaId = input.assinaturaId?.trim() || null;
  if (assinaturaId) {
    const [ass] = await db
      .select({ id: assinaturas.id, empresaId: assinaturas.empresaId })
      .from(assinaturas)
      .where(eq(assinaturas.id, assinaturaId))
      .limit(1);
    if (!ass || ass.empresaId !== input.empresaId) {
      return { ok: false, error: "assinatura_invalida" };
    }
  }

  const [created] = await db
    .insert(faturas)
    .values({
      empresaId: input.empresaId,
      assinaturaId,
      valorCents: input.valorCents,
      vencimento: input.vencimento ?? null,
      formaPagamento: forma,
      status,
      name: input.name?.trim() || null,
    })
    .returning();

  return { ok: true, fatura: created };
}

// ---------- MARCAR PAGA ----------
export type MarcarPagaResult =
  | { ok: true; fatura: Fatura }
  | { ok: false; error: "not_found" };

export async function marcarFaturaPaga(
  db: DbOrTx,
  id: string,
  formaPagamento?: string | null,
): Promise<MarcarPagaResult> {
  const set: Record<string, unknown> = { status: "paga", pagoEm: new Date(), updatedAt: new Date() };
  const forma = formaPagamento?.trim() || null;
  if (forma && isForma(forma)) set.formaPagamento = forma;

  const [updated] = await db.update(faturas).set(set).where(eq(faturas.id, id)).returning();
  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true, fatura: updated };
}

// ---------- UPDATE STATUS ----------
export type UpdateFaturaStatusResult =
  | { ok: true; fatura: Fatura }
  | { ok: false; error: "not_found" | "invalid_status" };

export async function updateFaturaStatus(
  db: DbOrTx,
  id: string,
  to: string,
): Promise<UpdateFaturaStatusResult> {
  if (!isStatus(to)) return { ok: false, error: "invalid_status" };

  const set: Record<string, unknown> = { status: to, updatedAt: new Date() };
  if (to === "paga") set.pagoEm = new Date();

  const [updated] = await db.update(faturas).set(set).where(eq(faturas.id, id)).returning();
  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true, fatura: updated };
}

// ---------- READ ----------
export async function getFaturaById(db: DbOrTx, id: string): Promise<Fatura | null> {
  const [row] = await db.select().from(faturas).where(eq(faturas.id, id)).limit(1);
  return row ?? null;
}

export async function listFaturasByEmpresa(db: DbOrTx, empresaId: string): Promise<Fatura[]> {
  return db
    .select()
    .from(faturas)
    .where(eq(faturas.empresaId, empresaId))
    .orderBy(desc(faturas.createdAt));
}

export type ListFaturasParams = { status?: StatusFatura };

// Faturas com nome da empresa, opcionalmente filtradas por status (para a tela de cobranca).
export async function listFaturasComEmpresa(
  db: DbOrTx,
  params: ListFaturasParams = {},
): Promise<FaturaComEmpresa[]> {
  const where = params.status ? eq(faturas.status, params.status) : undefined;
  const rows = await db
    .select({ fatura: faturas, empresaName: empresas.name })
    .from(faturas)
    .innerJoin(empresas, eq(faturas.empresaId, empresas.id))
    .where(where)
    .orderBy(asc(faturas.vencimento), desc(faturas.createdAt));

  return rows.map((r) => ({ ...r.fatura, empresaName: r.empresaName }));
}

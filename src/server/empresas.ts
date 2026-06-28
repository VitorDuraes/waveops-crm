// src/server/empresas.ts — repositorio de empresas (funcoes puras, db injetado por DbOrTx).
// Convencao igual ao WaveOps Prospect: validacao + retorno discriminado { ok, ... }.
// Autorizacao (guard) vive nas Server Actions; aqui ficam regra de dados e dedup.
import { and, desc, eq } from "drizzle-orm";
import { empresas } from "@/db/schema";
import {
  normalizeDocumento,
  normalizePhone,
  ORIGEM,
  SEGMENTO,
  STATUS_CLIENTE,
  type Origem,
  type Segmento,
  type StatusCliente,
} from "@/lib/validators";
import type { DbOrTx } from "./types";

export type Empresa = typeof empresas.$inferSelect;

// ---------- CREATE / UPSERT ----------
export type CreateEmpresaInput = {
  name: string;
  documento?: string | null;
  telefone?: string | null;
  website?: string | null;
  segmento?: string | null;
  origemDoLead?: string | null;
  statusDoCliente?: string | null;
};

export type CreateEmpresaResult =
  | { ok: true; empresa: Empresa; deduped: boolean }
  | { ok: false; error: "missing_fields" | "invalid_segmento" | "invalid_origem" | "invalid_status" };

function isSegmento(v: string): v is Segmento {
  return (SEGMENTO as readonly string[]).includes(v);
}
function isOrigem(v: string): v is Origem {
  return (ORIGEM as readonly string[]).includes(v);
}
function isStatusCliente(v: string): v is StatusCliente {
  return (STATUS_CLIENTE as readonly string[]).includes(v);
}

/**
 * Cria uma empresa. Dedup por documento normalizado E por telefone normalizado:
 * se ja existir uma empresa com o mesmo documento (ou o mesmo telefone), ATUALIZA
 * essa empresa com os campos informados em vez de criar uma duplicata.
 * Idempotente: reexecutar com o mesmo documento/telefone nao gera linha nova.
 * Retorna deduped=true quando o resultado veio de um match (update), false quando inseriu.
 */
export async function createEmpresa(
  db: DbOrTx,
  input: CreateEmpresaInput,
): Promise<CreateEmpresaResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "missing_fields" };

  const documento = input.documento ? normalizeDocumento(input.documento) : null;
  const documentoDisplay = input.documento?.trim() || null;
  const telefoneRaw = input.telefone?.trim() || null;
  const telefoneNormalized = telefoneRaw ? normalizePhone(telefoneRaw) : null;
  const website = input.website?.trim() || null;

  let segmento: Segmento | null = null;
  const segmentoRaw = input.segmento?.trim();
  if (segmentoRaw) {
    if (!isSegmento(segmentoRaw)) return { ok: false, error: "invalid_segmento" };
    segmento = segmentoRaw;
  }

  let origemDoLead: Origem | null = null;
  const origemRaw = input.origemDoLead?.trim();
  if (origemRaw) {
    if (!isOrigem(origemRaw)) return { ok: false, error: "invalid_origem" };
    origemDoLead = origemRaw;
  }

  let statusDoCliente: StatusCliente = "lead";
  const statusRaw = input.statusDoCliente?.trim();
  if (statusRaw) {
    if (!isStatusCliente(statusRaw)) return { ok: false, error: "invalid_status" };
    statusDoCliente = statusRaw;
  }

  // Campos a gravar (no insert e no update do dedup).
  const values = {
    name,
    documento,
    documentoDisplay,
    telefone: telefoneRaw,
    telefoneNormalized,
    website,
    segmento,
    origemDoLead,
    statusDoCliente,
  };

  // Dedup: procura match por documento OU por telefone (ambos UNIQUE parciais no schema).
  const existing = await findDuplicate(db, documento, telefoneNormalized);
  if (existing) {
    const [updated] = await db
      .update(empresas)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(empresas.id, existing.id))
      .returning();
    return { ok: true, empresa: updated, deduped: true };
  }

  const [created] = await db.insert(empresas).values(values).returning();
  return { ok: true, empresa: created, deduped: false };
}

// Acha uma empresa que colide por documento ou por telefone normalizado.
// Retorna a primeira encontrada (documento tem prioridade). null se nada colide.
async function findDuplicate(
  db: DbOrTx,
  documento: string | null,
  telefoneNormalized: string | null,
): Promise<Empresa | null> {
  if (documento) {
    const [byDoc] = await db
      .select()
      .from(empresas)
      .where(eq(empresas.documento, documento))
      .limit(1);
    if (byDoc) return byDoc;
  }
  if (telefoneNormalized) {
    const [byPhone] = await db
      .select()
      .from(empresas)
      .where(eq(empresas.telefoneNormalized, telefoneNormalized))
      .limit(1);
    if (byPhone) return byPhone;
  }
  return null;
}

// ---------- UPDATE ----------
export type UpdateEmpresaPatch = {
  name?: string;
  website?: string | null;
  segmento?: string | null;
  origemDoLead?: string | null;
  statusDoCliente?: string | null;
};

export type UpdateEmpresaResult =
  | { ok: true; empresa: Empresa }
  | { ok: false; error: "not_found" | "no_changes" | "invalid_segmento" | "invalid_origem" | "invalid_status" };

export async function updateEmpresa(
  db: DbOrTx,
  id: string,
  patch: UpdateEmpresaPatch,
): Promise<UpdateEmpresaResult> {
  const updates: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name) updates.name = name;
  }
  if (patch.website !== undefined) updates.website = patch.website?.trim() || null;

  if (patch.segmento !== undefined) {
    const s = patch.segmento?.trim() || null;
    if (s && !isSegmento(s)) return { ok: false, error: "invalid_segmento" };
    updates.segmento = s;
  }
  if (patch.origemDoLead !== undefined) {
    const o = patch.origemDoLead?.trim() || null;
    if (o && !isOrigem(o)) return { ok: false, error: "invalid_origem" };
    updates.origemDoLead = o;
  }
  if (patch.statusDoCliente !== undefined) {
    const st = patch.statusDoCliente?.trim() || null;
    if (!st || !isStatusCliente(st)) return { ok: false, error: "invalid_status" };
    updates.statusDoCliente = st;
  }

  if (Object.keys(updates).length === 0) return { ok: false, error: "no_changes" };
  updates.updatedAt = new Date();

  const [updated] = await db.update(empresas).set(updates).where(eq(empresas.id, id)).returning();
  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true, empresa: updated };
}

// ---------- READ ----------
export type ListEmpresasParams = {
  statusDoCliente?: StatusCliente;
};

export async function listEmpresas(
  db: DbOrTx,
  params: ListEmpresasParams = {},
): Promise<Empresa[]> {
  const conds = [];
  if (params.statusDoCliente) conds.push(eq(empresas.statusDoCliente, params.statusDoCliente));
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(empresas).where(where).orderBy(desc(empresas.createdAt));
}

export async function getEmpresaById(db: DbOrTx, id: string): Promise<Empresa | null> {
  const [empresa] = await db.select().from(empresas).where(eq(empresas.id, id)).limit(1);
  return empresa ?? null;
}

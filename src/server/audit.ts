// src/server/audit.ts — registro append-only de auditoria. Alimenta a timeline da record page
// e o compliance. db injetado por DbOrTx; pode rodar dentro de transacao com a acao auditada.
// Chamado pela camada de actions, nao pelos repos puros (mantem os repos testaveis e sem efeito).
import { and, desc, eq, inArray } from "drizzle-orm";
import { auditLog, users } from "@/db/schema";
import type { DbOrTx } from "./types";

export type AuditEntry = typeof auditLog.$inferSelect;

export type RecordAuditInput = {
  actorId?: string | null;
  acao: string; // ex: "criar", "editar", "mover_estagio"
  entidade: string; // ex: "oportunidade", "empresa", "proposta", "diagnostico"
  entidadeId: string;
  antes?: unknown;
  depois?: unknown;
};

// Grava um evento de auditoria. Append-only: nunca atualiza, so insere.
export async function recordAudit(db: DbOrTx, input: RecordAuditInput): Promise<void> {
  await db.insert(auditLog).values({
    actorId: input.actorId ?? null,
    acao: input.acao,
    entidade: input.entidade,
    entidadeId: input.entidadeId,
    antes: input.antes ?? null,
    depois: input.depois ?? null,
  });
}

// Timeline de um registro (entidade + id), mais recente primeiro.
export async function listAuditByTarget(
  db: DbOrTx,
  entidade: string,
  entidadeId: string,
  limit = 100,
): Promise<AuditEntry[]> {
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entidade, entidade), eq(auditLog.entidadeId, entidadeId)))
    .orderBy(desc(auditLog.at))
    .limit(limit);
}

// Nomes dos autores (actorId -> name) para a timeline. Ignora ids nulos/repetidos.
export async function getActorNames(
  db: DbOrTx,
  ids: (string | null)[],
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (unique.length === 0) return {};
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, unique));
  const map: Record<string, string> = {};
  for (const r of rows) map[r.id] = r.name;
  return map;
}

// src/server/search.ts — busca global do CRM. db injetado por DbOrTx (testavel).
// Busca textual case-insensitive (ilike) em empresas, pessoas e oportunidades.
// Se a query tem digitos, tambem casa empresas por documento ou telefone normalizado exatos.
// Limite de 20 por grupo. Query vazia retorna grupos vazios.
import { asc, eq, ilike, or } from "drizzle-orm";
import { empresas, oportunidades, pessoas } from "@/db/schema";
import { normalizeDocumento, normalizePhone } from "@/lib/validators";
import type { Empresa } from "./empresas";
import type { Oportunidade } from "./oportunidades";
import type { Pessoa } from "./pessoas";
import type { DbOrTx } from "./types";

const LIMITE = 20;

// Oportunidade enriquecida com o nome da empresa, para o resultado da busca.
export type OportunidadeComEmpresa = Oportunidade & { empresaName: string };

export type SearchResult = {
  empresas: Empresa[];
  pessoas: Pessoa[];
  oportunidades: OportunidadeComEmpresa[];
};

const EMPTY: SearchResult = { empresas: [], pessoas: [], oportunidades: [] };

/**
 * Busca global por uma query livre. Retorna ate 20 resultados por grupo.
 * - empresas: por name (ilike). Se a query tem digitos, tambem por documento OU
 *   telefoneNormalized exatos (apos normalizar com normalizeDocumento/normalizePhone).
 * - pessoas: por firstName, lastName ou email (ilike).
 * - oportunidades: por name (ilike), com innerJoin em empresas para trazer empresaName.
 * Query vazia (apos trim) retorna grupos vazios.
 */
export async function searchAll(db: DbOrTx, query: string): Promise<SearchResult> {
  const q = query?.trim();
  if (!q) return EMPTY;

  const like = `%${q}%`;

  // Se a query contem digitos, prepara os matches exatos por documento/telefone.
  const hasDigits = /\d/.test(q);
  const documento = hasDigits ? normalizeDocumento(q) : null;
  const telefoneNormalized = hasDigits ? normalizePhone(q) : null;

  // Empresas: name por ilike, mais documento/telefone exatos quando aplicavel.
  const empresaConds = [ilike(empresas.name, like)];
  if (documento) empresaConds.push(eq(empresas.documento, documento));
  if (telefoneNormalized) empresaConds.push(eq(empresas.telefoneNormalized, telefoneNormalized));

  const [empresasRows, pessoasRows, oportunidadesRows] = await Promise.all([
    db
      .select()
      .from(empresas)
      .where(or(...empresaConds))
      .orderBy(asc(empresas.name))
      .limit(LIMITE),
    db
      .select()
      .from(pessoas)
      .where(
        or(
          ilike(pessoas.firstName, like),
          ilike(pessoas.lastName, like),
          ilike(pessoas.email, like),
        ),
      )
      .orderBy(asc(pessoas.firstName))
      .limit(LIMITE),
    db
      .select({ oportunidade: oportunidades, empresaName: empresas.name })
      .from(oportunidades)
      .innerJoin(empresas, eq(oportunidades.empresaId, empresas.id))
      .where(ilike(oportunidades.name, like))
      .orderBy(asc(oportunidades.name))
      .limit(LIMITE),
  ]);

  return {
    empresas: empresasRows,
    pessoas: pessoasRows,
    oportunidades: oportunidadesRows.map((r) => ({ ...r.oportunidade, empresaName: r.empresaName })),
  };
}

// src/server/pessoas.ts — repositorio basico de pessoas (contatos de uma empresa). db injetado.
import { asc, eq } from "drizzle-orm";
import { pessoas } from "@/db/schema";
import { normalizePhone } from "@/lib/validators";
import type { DbOrTx } from "./types";

export type Pessoa = typeof pessoas.$inferSelect;

export type CreatePessoaInput = {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  documento?: string | null;
  empresaId: string;
};

export type CreatePessoaResult =
  | { ok: true; pessoa: Pessoa }
  | { ok: false; error: "missing_fields" };

export async function createPessoa(
  db: DbOrTx,
  input: CreatePessoaInput,
): Promise<CreatePessoaResult> {
  const firstName = input.firstName?.trim();
  if (!firstName || !input.empresaId) return { ok: false, error: "missing_fields" };

  const phone = input.phone?.trim() || null;
  const phoneNormalized = phone ? normalizePhone(phone) : null;

  const [created] = await db
    .insert(pessoas)
    .values({
      firstName,
      lastName: input.lastName?.trim() || null,
      email: input.email?.trim() || null,
      phone,
      phoneNormalized,
      documento: input.documento?.trim() || null,
      empresaId: input.empresaId,
    })
    .returning();

  return { ok: true, pessoa: created };
}

export async function listPessoasByEmpresa(db: DbOrTx, empresaId: string): Promise<Pessoa[]> {
  return db
    .select()
    .from(pessoas)
    .where(eq(pessoas.empresaId, empresaId))
    .orderBy(asc(pessoas.firstName));
}

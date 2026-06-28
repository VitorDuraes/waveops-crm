"use server";
// src/server/actions/pessoas.actions.ts — Server Actions de pessoas (contatos de uma empresa).
// Guard de sessao (requireUser) + parse de FormData ANTES de qualquer escrita. Logica no repo.
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { getEmpresaById } from "@/server/empresas";
import * as repo from "@/server/pessoas";

export type PessoaFormState = { ok: boolean; message: string } | null;

function mapCreateError(error: string): string {
  switch (error) {
    case "missing_fields":
      return "Informe o nome e a empresa do contato.";
    default:
      return "Não foi possível salvar o contato.";
  }
}

export async function createPessoaAction(
  _prev: PessoaFormState,
  formData: FormData,
): Promise<PessoaFormState> {
  await requireUser();

  const empresaId = String(formData.get("empresaId") ?? "");

  // empresaId vem de hidden controlavel pelo cliente: confirma que a empresa existe
  // antes de gravar (evita erro de FK e contato orfao).
  if (empresaId) {
    const empresa = await getEmpresaById(db, empresaId);
    if (!empresa) return { ok: false, message: "Empresa não encontrada." };
  }

  const input: repo.CreatePessoaInput = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    documento: String(formData.get("documento") ?? "") || null,
    empresaId,
  };

  const result = await repo.createPessoa(db, input);
  if (!result.ok) {
    return { ok: false, message: mapCreateError(result.error) };
  }

  revalidatePath(`/empresas/${empresaId}`);
  return { ok: true, message: "Contato adicionado." };
}

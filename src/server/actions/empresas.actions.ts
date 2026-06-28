"use server";
// src/server/actions/empresas.actions.ts — Server Actions de empresas.
// Guard de sessao (requireUser) + parse de FormData ANTES de qualquer escrita. Logica no repo.
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import * as repo from "@/server/empresas";

export type EmpresaFormState = { ok: boolean; message: string } | null;

function mapCreateError(error: string): string {
  switch (error) {
    case "missing_fields":
      return "Informe o nome da empresa.";
    case "invalid_segmento":
      return "Segmento inválido.";
    case "invalid_origem":
      return "Origem inválida.";
    case "invalid_status":
      return "Status do cliente inválido.";
    default:
      return "Não foi possível salvar a empresa.";
  }
}

export async function createEmpresaAction(
  _prev: EmpresaFormState,
  formData: FormData,
): Promise<EmpresaFormState> {
  await requireUser();

  const input: repo.CreateEmpresaInput = {
    name: String(formData.get("name") ?? ""),
    documento: String(formData.get("documento") ?? "") || null,
    telefone: String(formData.get("telefone") ?? "") || null,
    website: String(formData.get("website") ?? "") || null,
    segmento: String(formData.get("segmento") ?? "") || null,
    origemDoLead: String(formData.get("origemDoLead") ?? "") || null,
    statusDoCliente: String(formData.get("statusDoCliente") ?? "") || null,
  };

  const result = await repo.createEmpresa(db, input);
  if (!result.ok) {
    return { ok: false, message: mapCreateError(result.error) };
  }

  revalidatePath("/empresas");
  revalidatePath("/funil");
  return {
    ok: true,
    message: result.deduped ? "Empresa já existia: dados atualizados." : "Empresa criada.",
  };
}

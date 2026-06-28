// src/app/(app)/cobranca/page.tsx — Cobranca (Server Component). Busca dados em runtime.
// Assinaturas (recorrente, fonte do MRR) e Faturas (cobrancas avulsas). Forms + tabelas client.
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import {
  AssinaturaCreateForm,
  type EmpresaOption,
  type PlanoOption,
} from "@/components/cobranca/assinatura-create-form";
import { FaturaCreateForm } from "@/components/cobranca/fatura-create-form";
import { AssinaturasTable } from "@/components/cobranca/assinaturas-table";
import { FaturasTable } from "@/components/cobranca/faturas-table";
import { listAssinaturasComContexto } from "@/server/assinaturas";
import { listFaturasComEmpresa } from "@/server/faturas";
import { listEmpresas } from "@/server/empresas";
import { listPlanosAtivos } from "@/server/planos";

export const dynamic = "force-dynamic";

export default async function CobrancaPage() {
  await requireUser();

  // Busca em paralelo: assinaturas e faturas (com contexto) + empresas e planos (para os selects).
  const [assinaturas, faturas, empresas, planos] = await Promise.all([
    listAssinaturasComContexto(db),
    listFaturasComEmpresa(db),
    listEmpresas(db),
    listPlanosAtivos(db),
  ]);

  const empresaOptions: EmpresaOption[] = empresas.map((e) => ({ id: e.id, name: e.name }));
  const planoOptions: PlanoOption[] = planos.map((p) => ({
    id: p.id,
    name: p.name,
    precoMensalCents: p.precoMensalCents,
  }));

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="border-b border-neutral-200 pb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Cobrança</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Assinaturas recorrentes e faturas das empresas.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Assinaturas</h3>
            <p className="mt-1 text-sm text-neutral-500">
              {assinaturas.length}{" "}
              {assinaturas.length === 1 ? "assinatura" : "assinaturas"}. Só assinatura ativa entra no MRR.
            </p>
          </div>
          <AssinaturaCreateForm empresas={empresaOptions} planos={planoOptions} />
        </div>
        <AssinaturasTable assinaturas={assinaturas} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Faturas</h3>
            <p className="mt-1 text-sm text-neutral-500">
              {faturas.length} {faturas.length === 1 ? "fatura" : "faturas"}.
            </p>
          </div>
          <FaturaCreateForm empresas={empresaOptions} />
        </div>
        <FaturasTable faturas={faturas} />
      </section>
    </div>
  );
}

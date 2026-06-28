// src/app/(app)/propostas/page.tsx — Kanban de propostas (Server Component). Busca dados em runtime.
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { PropostasBoard } from "@/components/propostas/propostas-board";
import { PropostaCreateForm, type OportunidadeOption } from "@/components/propostas/proposta-create-form";
import { listPropostasComContexto } from "@/server/propostas";
import { listOportunidadesComEmpresa } from "@/server/oportunidades";

export const dynamic = "force-dynamic";

export default async function PropostasPage() {
  await requireUser();

  // Busca em paralelo: propostas (com contexto) e oportunidades (para o select).
  const [propostas, oportunidades] = await Promise.all([
    listPropostasComContexto(db),
    listOportunidadesComEmpresa(db),
  ]);

  const oportunidadeOptions: OportunidadeOption[] = oportunidades.map((o) => ({
    id: o.id,
    label: `${o.name} (${o.empresaName})`,
  }));

  return (
    <div className="flex h-full w-full flex-col gap-6">
      <header className="flex flex-none flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Propostas</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Arraste um card para mudar o status. {propostas.length}{" "}
            {propostas.length === 1 ? "proposta" : "propostas"}.
          </p>
        </div>
        <PropostaCreateForm oportunidades={oportunidadeOptions} />
      </header>

      <PropostasBoard propostas={propostas} />
    </div>
  );
}

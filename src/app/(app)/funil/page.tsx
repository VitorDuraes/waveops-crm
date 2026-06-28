// src/app/(app)/funil/page.tsx — Kanban do funil (Server Component). Busca dados em runtime.
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { FunilBoard, type FunilCard } from "@/components/funil/funil-board";
import { OportunidadeCreateForm, type EmpresaOption } from "@/components/funil/oportunidade-create-form";
import { listEmpresas } from "@/server/empresas";
import { listOportunidadesComEmpresa } from "@/server/oportunidades";
import type { Stage } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function FunilPage() {
  await requireUser();

  // Busca em paralelo: oportunidades (com nome da empresa) e empresas (para o select).
  const [oportunidades, empresas] = await Promise.all([
    listOportunidadesComEmpresa(db),
    listEmpresas(db),
  ]);

  const cards: FunilCard[] = oportunidades.map((o) => ({
    id: o.id,
    name: o.name,
    empresaName: o.empresaName,
    stage: o.stage as Stage,
    valorMensalEstimadoCents: o.valorMensalEstimadoCents,
    probabilidade: o.probabilidade,
  }));

  const empresaOptions: EmpresaOption[] = empresas.map((e) => ({ id: e.id, name: e.name }));

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Funil de vendas</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Arraste um card para mudar o estágio. {cards.length}{" "}
            {cards.length === 1 ? "oportunidade" : "oportunidades"}.
          </p>
        </div>
        <OportunidadeCreateForm empresas={empresaOptions} />
      </header>

      <FunilBoard cards={cards} />
    </div>
  );
}

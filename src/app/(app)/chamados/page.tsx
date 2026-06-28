// src/app/(app)/chamados/page.tsx — Chamados (suporte, Server Component). Busca dados em runtime.
// Lista de chamados com empresa + form de novo chamado. Header conta os chamados em aberto.
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ChamadoCreateForm, type EmpresaOption } from "@/components/chamados/chamado-create-form";
import { ChamadosTable } from "@/components/chamados/chamados-table";
import { listChamadosComEmpresa } from "@/server/chamados";
import { listEmpresas } from "@/server/empresas";

export const dynamic = "force-dynamic";

export default async function ChamadosPage() {
  await requireUser();

  // Busca em paralelo: chamados (com empresa) e empresas (para o select do form).
  const [chamados, empresas] = await Promise.all([
    listChamadosComEmpresa(db),
    listEmpresas(db),
  ]);

  const empresaOptions: EmpresaOption[] = empresas.map((e) => ({ id: e.id, name: e.name }));
  const abertos = chamados.filter((c) => c.status === "aberto").length;

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Chamados</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {abertos} {abertos === 1 ? "chamado aberto" : "chamados abertos"}. Suporte das empresas.
          </p>
        </div>
        <ChamadoCreateForm empresas={empresaOptions} />
      </header>

      <ChamadosTable chamados={chamados} />
    </div>
  );
}

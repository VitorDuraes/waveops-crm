// src/app/(app)/empresas/page.tsx — lista de empresas (Server Component). Consulta o banco
// em runtime (force-dynamic), por isso o `next build` nao precisa de banco.
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { SEGMENTO_LABELS } from "@/lib/crm/labels";
import { formatPhoneBR } from "@/lib/crm/format";
import { SegmentoBadge, StatusClienteBadge } from "@/components/ui/badge";
import { EmpresaCreateForm } from "@/components/empresas/empresa-create-form";
import { listEmpresas } from "@/server/empresas";
import type { Segmento, StatusCliente } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  await requireUser();
  const empresas = await listEmpresas(db);

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Empresas</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Clientes e leads. {empresas.length} {empresas.length === 1 ? "registro" : "registros"}.
          </p>
        </div>
        <EmpresaCreateForm />
      </header>

      {empresas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Nenhuma empresa ainda. Use o botão Nova empresa para começar.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Segmento</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Website</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {empresas.map((empresa) => (
                <tr key={empresa.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{empresa.name}</td>
                  <td className="px-4 py-3">
                    <StatusClienteBadge status={empresa.statusDoCliente as StatusCliente} />
                  </td>
                  <td className="px-4 py-3">
                    <SegmentoBadge
                      segmento={
                        empresa.segmento && empresa.segmento in SEGMENTO_LABELS
                          ? (empresa.segmento as Segmento)
                          : null
                      }
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-neutral-600">
                    {formatPhoneBR(empresa.telefoneNormalized)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {empresa.website ? (
                      <a
                        href={empresa.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-brand)] hover:underline"
                      >
                        {empresa.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

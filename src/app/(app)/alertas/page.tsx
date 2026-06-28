// src/app/(app)/alertas/page.tsx — Alertas de risco (Server Component). Busca dados em runtime.
// Sinais antecipados de churn: fatura atrasada, assinatura vencida, lead parado no funil.
// getAlertas roda no servidor; agrupamos por tipo e mostramos contagem + link para a empresa.
import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { TIPO_ALERTA_LABELS } from "@/lib/crm/labels";
import { getAlertas } from "@/server/alerts";
import type { Alerta } from "@/lib/crm/alerts";
import type { TipoAlerta } from "@/lib/validators";

export const dynamic = "force-dynamic";

// Ordem de exibicao das secoes. Espelha a ordem dos labels de risco.
const TIPOS: TipoAlerta[] = ["fatura_atrasada", "assinatura_vencida", "lead_parado"];

// Secao de uma categoria de risco. Server-safe, sem arquivo extra.
// So renderiza quando ha alertas do tipo (a contagem entra no titulo).
function SecaoAlerta({ tipo, alertas }: { tipo: TipoAlerta; alertas: Alerta[] }) {
  if (alertas.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-900">{TIPO_ALERTA_LABELS[tipo]}</h3>
        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">
          {alertas.length} {alertas.length === 1 ? "risco" : "riscos"}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {alertas.map((alerta) => (
          <li
            key={`${alerta.tipo}-${alerta.refId}`}
            className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm text-neutral-700">{alerta.descricao}</span>
            <Link
              href={`/empresas/${alerta.empresaId}`}
              className="text-sm font-medium text-[var(--color-brand)] hover:underline"
            >
              {alerta.empresaName}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AlertasPage() {
  await requireUser();
  const alertas = await getAlertas(db);

  // Agrupa por tipo uma vez. As secoes leem o grupo pronto.
  const porTipo: Record<TipoAlerta, Alerta[]> = {
    fatura_atrasada: [],
    assinatura_vencida: [],
    lead_parado: [],
  };
  for (const alerta of alertas) porTipo[alerta.tipo].push(alerta);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="border-b border-neutral-200 pb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Alertas de risco</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Sinais antecipados de churn. {alertas.length}{" "}
          {alertas.length === 1 ? "risco aberto" : "riscos abertos"}.
        </p>
      </header>

      {alertas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-8 text-center text-sm font-medium text-emerald-800">
          Nenhum risco no momento.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {TIPOS.map((tipo) => (
            <SecaoAlerta key={tipo} tipo={tipo} alertas={porTipo[tipo]} />
          ))}
        </div>
      )}
    </div>
  );
}

// src/app/(app)/dashboards/page.tsx — Dashboards de receita, funil, perdas e cobranca (Server Component).
// Busca em runtime via getDashboard(db). Calculo nas funcoes puras de @/lib/crm/metrics.
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/server/metrics";
import { StatCard } from "@/components/dashboards/stat-card";
import { BarList } from "@/components/dashboards/bar-list";
import { MOTIVO_PERDA_LABELS, STAGE_LABELS } from "@/lib/crm/labels";
import { formatBRLFromCents } from "@/lib/crm/format";
import type { MotivoPerda, Stage } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function DashboardsPage() {
  await requireUser();

  const d = await getDashboard(db);

  const funilItems = d.funil.map((b) => ({
    label: STAGE_LABELS[b.stage as Stage],
    count: b.count,
    valor: b.valorCents,
  }));

  const perdasItems = d.perdas.map((b) => ({
    label: MOTIVO_PERDA_LABELS[b.motivo as MotivoPerda],
    count: b.count,
  }));

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="border-b border-neutral-200 pb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Dashboards</h2>
        <p className="mt-1 text-sm text-neutral-500">Receita, funil, perdas e cobranca em tempo real.</p>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-neutral-900">Receita</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="MRR" value={formatBRLFromCents(d.mrrCents)} hint="Receita recorrente mensal" />
          <StatCard label="ARR" value={formatBRLFromCents(d.arrCents)} hint="Receita recorrente anual" />
          <StatCard label="Assinaturas ativas" value={String(d.ativas)} />
          <StatCard label="Churn" value={`${d.churnPercent}%`} hint="No mes" />
          <StatCard label="Novas no mes" value={String(d.novasNoMes)} />
          <StatCard label="Canceladas no mes" value={String(d.canceladasNoMes)} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-neutral-900">Funil</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <BarList items={funilItems} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Win rate" value={`${d.winRatePercent}%`} hint="Ganhos sobre fechados" />
            <StatCard label="Pipeline aberto" value={formatBRLFromCents(d.pipelineAbertoCents)} />
            <StatCard label="Pipeline ponderado" value={formatBRLFromCents(d.pipelinePonderadoCents)} hint="Por probabilidade" />
            <StatCard
              label="Ciclo medio"
              value={d.cicloMedioDias != null ? `${d.cicloMedioDias} dias` : "-"}
              hint="Lead ate ganho"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-neutral-900">Perdas</h3>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <BarList items={perdasItems} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-neutral-900">Cobranca</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Vencidas"
            value={formatBRLFromCents(d.vencidas.totalCents)}
            hint={`${d.vencidas.count} ${d.vencidas.count === 1 ? "fatura" : "faturas"}`}
          />
          <StatCard
            label="Proximos 7 dias"
            value={formatBRLFromCents(d.proximos7.totalCents)}
            hint={`${d.proximos7.count} ${d.proximos7.count === 1 ? "fatura" : "faturas"}`}
          />
          <StatCard
            label="Recebido no mes"
            value={formatBRLFromCents(d.recebidoNoMes.totalCents)}
            hint={`${d.recebidoNoMes.count} ${d.recebidoNoMes.count === 1 ? "fatura" : "faturas"}`}
          />
        </div>
      </section>
    </div>
  );
}

// src/app/(app)/dashboards/page.tsx — Dashboards de receita, funil, perdas e cobranca (Server Component).
// Busca em runtime via getDashboard(db). Calculo nas funcoes puras de @/lib/crm/metrics.
// UI: StatCard com numero animado (CountUp/ReactBits) + GradientText no titulo.
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/server/metrics";
import { StatCard } from "@/components/dashboards/stat-card";
import { BarList } from "@/components/dashboards/bar-list";
import GradientText from "@/components/ui/reactbits/GradientText";
import { MOTIVO_PERDA_LABELS, STAGE_LABELS } from "@/lib/crm/labels";
import type { MotivoPerda, Stage } from "@/lib/validators";

export const dynamic = "force-dynamic";

// Stops violeta -> indigo: legiveis sobre o fundo claro do app (ciano reprovaria contraste).
const BRAND_GRADIENT = ["#7c3aed", "#4f46e5", "#7c3aed"];

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
        <div className="w-fit">
          <GradientText
            colors={BRAND_GRADIENT}
            animationSpeed={10}
            className="text-2xl font-semibold tracking-tight"
          >
            Dashboards
          </GradientText>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Receita, funil, perdas e cobrança em tempo real.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-neutral-900">Receita</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="MRR" value={d.mrrCents} format="money" hint="Receita recorrente mensal" accent />
          <StatCard label="ARR" value={d.arrCents} format="money" hint="Receita recorrente anual" accent />
          <StatCard label="Assinaturas ativas" value={d.ativas} format="int" />
          <StatCard label="Churn" value={d.churnPercent} format="percent" hint="No mês" />
          <StatCard label="Novas no mês" value={d.novasNoMes} format="int" />
          <StatCard label="Canceladas no mês" value={d.canceladasNoMes} format="int" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-neutral-900">Funil</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <BarList items={funilItems} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Win rate" value={d.winRatePercent} format="percent" hint="Ganhos sobre fechados" />
            <StatCard label="Pipeline aberto" value={d.pipelineAbertoCents} format="money" />
            <StatCard
              label="Pipeline ponderado"
              value={d.pipelinePonderadoCents}
              format="money"
              hint="Por probabilidade"
            />
            <StatCard label="Ciclo médio" value={d.cicloMedioDias} format="days" hint="Lead até ganho" />
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
        <h3 className="text-base font-semibold text-neutral-900">Cobrança</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Vencidas"
            value={d.vencidas.totalCents}
            format="money"
            hint={`${d.vencidas.count} ${d.vencidas.count === 1 ? "fatura" : "faturas"}`}
          />
          <StatCard
            label="Próximos 7 dias"
            value={d.proximos7.totalCents}
            format="money"
            hint={`${d.proximos7.count} ${d.proximos7.count === 1 ? "fatura" : "faturas"}`}
          />
          <StatCard
            label="Recebido no mês"
            value={d.recebidoNoMes.totalCents}
            format="money"
            hint={`${d.recebidoNoMes.count} ${d.recebidoNoMes.count === 1 ? "fatura" : "faturas"}`}
          />
        </div>
      </section>
    </div>
  );
}

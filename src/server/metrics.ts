// src/server/metrics.ts — repo fino do dashboard: busca as linhas e delega o calculo as
// funcoes PURAS de @/lib/crm/metrics (testadas em metrics.test.ts). db por DbOrTx.
// Limites do mes em UTC (Railway roda em UTC). Edge no virar do mes e aceitavel no MVP.
import { assinaturas, faturas, oportunidades } from "@/db/schema";
import { MOTIVO_PERDA, STAGE } from "@/lib/validators";
import * as m from "@/lib/crm/metrics";
import type { DbOrTx } from "./types";

export type DashboardData = {
  mrrCents: number;
  arrCents: number;
  ativas: number;
  novasNoMes: number;
  canceladasNoMes: number;
  churnPercent: number;
  winRatePercent: number;
  pipelineAbertoCents: number;
  pipelinePonderadoCents: number;
  cicloMedioDias: number | null;
  funil: m.StageBucket[];
  perdas: m.MotivoBucket[];
  vencidas: m.FaturaResumo;
  proximos7: m.FaturaResumo;
  recebidoNoMes: m.FaturaResumo;
};

export async function getDashboard(db: DbOrTx, now: Date = new Date()): Promise<DashboardData> {
  const [assRows, opsRows, ftRows] = await Promise.all([
    db
      .select({
        status: assinaturas.status,
        valorMensalCents: assinaturas.valorMensalCents,
        dataInicio: assinaturas.dataInicio,
        canceladaEm: assinaturas.canceladaEm,
      })
      .from(assinaturas),
    db
      .select({
        stage: oportunidades.stage,
        valorMensalEstimadoCents: oportunidades.valorMensalEstimadoCents,
        probabilidade: oportunidades.probabilidade,
        motivoDePerda: oportunidades.motivoDePerda,
        createdAt: oportunidades.createdAt,
        updatedAt: oportunidades.updatedAt,
      })
      .from(oportunidades),
    db
      .select({
        status: faturas.status,
        valorCents: faturas.valorCents,
        vencimento: faturas.vencimento,
        pagoEm: faturas.pagoEm,
      })
      .from(faturas),
  ]);

  const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const proximoMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const mrrCents = m.computeMrrCents(assRows);

  return {
    mrrCents,
    arrCents: m.computeArrCents(mrrCents),
    ativas: m.countAtivas(assRows),
    novasNoMes: m.novasNoPeriodo(assRows, inicioMes, proximoMes),
    canceladasNoMes: m.canceladasNoPeriodo(assRows, inicioMes, proximoMes),
    churnPercent: m.churnRatePercent(assRows, inicioMes, proximoMes),
    winRatePercent: m.winRatePercent(opsRows),
    pipelineAbertoCents: m.pipelineAbertoCents(opsRows),
    pipelinePonderadoCents: m.pipelinePonderadoCents(opsRows),
    cicloMedioDias: m.cicloMedioDias(opsRows),
    funil: m.funnelByStage(opsRows, STAGE),
    perdas: m.perdasPorMotivo(opsRows, MOTIVO_PERDA),
    vencidas: m.faturasVencidas(ftRows, now),
    proximos7: m.proximosVencimentos(ftRows, now, 7),
    recebidoNoMes: m.recebidoNoPeriodo(ftRows, inicioMes, proximoMes),
  };
}

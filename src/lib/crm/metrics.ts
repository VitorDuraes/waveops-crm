// src/lib/crm/metrics.ts — calculo PURO das metricas de receita e funil (sem banco, sem Date.now).
// Toda regra critica (MRR, churn, win rate) vive aqui, em funcoes puras, alvo de teste determinístico.
// O repo src/server/metrics.ts busca as linhas e chama estas funcoes. Datas/limites entram por parametro.
//
// DEFINICAO DE MRR (decisao registrada na spec 2026-06-28):
// MRR = soma do valorMensalCents das assinaturas com status "ativo". O valorMensalCents e um
// SNAPSHOT mensal gravado na assinatura, entao plano anual ja entra normalizado para o mes e nao
// depende de join com plano nem de tratar ciclo aqui. Pausada/cancelada/vencida NAO entram no MRR.

export type AssinaturaMetric = {
  status: string;
  valorMensalCents: number;
  dataInicio: Date | null;
  canceladaEm: Date | null;
};

export type OportunidadeMetric = {
  stage: string;
  valorMensalEstimadoCents: number | null;
  probabilidade: number | null;
  motivoDePerda: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FaturaMetric = {
  status: string;
  valorCents: number;
  vencimento: Date | null;
  pagoEm: Date | null;
};

const ATIVA = "ativo";
const GANHO = "ganho";
const PERDIDO = "perdido";

// True se d esta dentro de [start, end) (limite inferior inclusivo, superior exclusivo).
function inRange(d: Date | null, start: Date, end: Date): boolean {
  if (!d) return false;
  const t = d.getTime();
  return t >= start.getTime() && t < end.getTime();
}

// ---------- Receita recorrente ----------

// MRR em centavos: soma das assinaturas ativas.
export function computeMrrCents(assinaturas: AssinaturaMetric[]): number {
  return assinaturas.reduce((sum, a) => (a.status === ATIVA ? sum + a.valorMensalCents : sum), 0);
}

// ARR = MRR * 12.
export function computeArrCents(mrrCents: number): number {
  return mrrCents * 12;
}

export function countAtivas(assinaturas: AssinaturaMetric[]): number {
  return assinaturas.filter((a) => a.status === ATIVA).length;
}

// Novas assinaturas no periodo: dataInicio dentro de [start, end).
export function novasNoPeriodo(assinaturas: AssinaturaMetric[], start: Date, end: Date): number {
  return assinaturas.filter((a) => inRange(a.dataInicio, start, end)).length;
}

// Canceladas no periodo: canceladaEm dentro de [start, end).
export function canceladasNoPeriodo(
  assinaturas: AssinaturaMetric[],
  start: Date,
  end: Date,
): number {
  return assinaturas.filter((a) => inRange(a.canceladaEm, start, end)).length;
}

// Churn de logos (aprox.): canceladas no periodo / base ativa no inicio do periodo.
// Base no inicio ~= ativas hoje + canceladas no periodo (essas estavam ativas no inicio).
// Retorna percentual 0..100. Sem base -> 0.
export function churnRatePercent(
  assinaturas: AssinaturaMetric[],
  start: Date,
  end: Date,
): number {
  const canceladas = canceladasNoPeriodo(assinaturas, start, end);
  const base = countAtivas(assinaturas) + canceladas;
  if (base === 0) return 0;
  return Math.round((canceladas / base) * 1000) / 10;
}

// ---------- Funil ----------

export type StageBucket = { stage: string; count: number; valorCents: number };

// Conversao por estagio: contagem e soma do valor estimado em cada estagio, na ordem dada.
export function funnelByStage(
  oportunidades: OportunidadeMetric[],
  stages: readonly string[],
): StageBucket[] {
  return stages.map((stage) => {
    const dela = oportunidades.filter((o) => o.stage === stage);
    const valorCents = dela.reduce((s, o) => s + (o.valorMensalEstimadoCents ?? 0), 0);
    return { stage, count: dela.length, valorCents };
  });
}

// Win rate (%): ganhos / (ganhos + perdidos). Sem deals fechados -> 0.
export function winRatePercent(oportunidades: OportunidadeMetric[]): number {
  const ganhos = oportunidades.filter((o) => o.stage === GANHO).length;
  const perdidos = oportunidades.filter((o) => o.stage === PERDIDO).length;
  const fechados = ganhos + perdidos;
  if (fechados === 0) return 0;
  return Math.round((ganhos / fechados) * 1000) / 10;
}

// Aberta = nao ganho e nao perdido.
function isAberta(o: OportunidadeMetric): boolean {
  return o.stage !== GANHO && o.stage !== PERDIDO;
}

// Valor do pipeline aberto (centavos): soma do valor estimado das oportunidades abertas.
export function pipelineAbertoCents(oportunidades: OportunidadeMetric[]): number {
  return oportunidades
    .filter(isAberta)
    .reduce((s, o) => s + (o.valorMensalEstimadoCents ?? 0), 0);
}

// Pipeline ponderado (centavos): valor estimado * probabilidade/100, so abertas. Sem ML.
export function pipelinePonderadoCents(oportunidades: OportunidadeMetric[]): number {
  return Math.round(
    oportunidades
      .filter(isAberta)
      .reduce((s, o) => s + (o.valorMensalEstimadoCents ?? 0) * ((o.probabilidade ?? 0) / 100), 0),
  );
}

export type MotivoBucket = { motivo: string; count: number };

// Perdas por motivo, na ordem de motivos dada (so conta oportunidades perdidas).
export function perdasPorMotivo(
  oportunidades: OportunidadeMetric[],
  motivos: readonly string[],
): MotivoBucket[] {
  const perdidas = oportunidades.filter((o) => o.stage === PERDIDO);
  return motivos.map((motivo) => ({
    motivo,
    count: perdidas.filter((o) => o.motivoDePerda === motivo).length,
  }));
}

// Ciclo medio de venda em dias (aprox.): media de (updatedAt - createdAt) das ganhas.
// Aproximacao: usa updatedAt como instante do ganho. null se nao houver ganhas.
export function cicloMedioDias(oportunidades: OportunidadeMetric[]): number | null {
  const ganhas = oportunidades.filter((o) => o.stage === GANHO);
  if (ganhas.length === 0) return null;
  const totalDias = ganhas.reduce((s, o) => {
    const ms = o.updatedAt.getTime() - o.createdAt.getTime();
    return s + ms / (1000 * 60 * 60 * 24);
  }, 0);
  return Math.round((totalDias / ganhas.length) * 10) / 10;
}

// ---------- Cobranca ----------

export type FaturaResumo = { count: number; totalCents: number };

// Em aberto = status criada ou em_aberto.
function emAberto(f: FaturaMetric): boolean {
  return f.status === "criada" || f.status === "em_aberto";
}

// Faturas vencidas: status "vencida", OU em aberto com vencimento ja passado (< now).
export function faturasVencidas(faturas: FaturaMetric[], now: Date): FaturaResumo {
  const vencidas = faturas.filter(
    (f) => f.status === "vencida" || (emAberto(f) && f.vencimento != null && f.vencimento.getTime() < now.getTime()),
  );
  return {
    count: vencidas.length,
    totalCents: vencidas.reduce((s, f) => s + f.valorCents, 0),
  };
}

// Proximos vencimentos: em aberto com vencimento em [now, now + dias).
export function proximosVencimentos(
  faturas: FaturaMetric[],
  now: Date,
  dias: number,
): FaturaResumo {
  const limite = new Date(now.getTime() + dias * 24 * 60 * 60 * 1000);
  const proximas = faturas.filter(
    (f) => emAberto(f) && f.vencimento != null && inRange(f.vencimento, now, limite),
  );
  return {
    count: proximas.length,
    totalCents: proximas.reduce((s, f) => s + f.valorCents, 0),
  };
}

// Recebido no periodo: faturas pagas com pagoEm em [start, end).
export function recebidoNoPeriodo(faturas: FaturaMetric[], start: Date, end: Date): FaturaResumo {
  const pagas = faturas.filter((f) => f.status === "paga" && inRange(f.pagoEm, start, end));
  return {
    count: pagas.length,
    totalCents: pagas.reduce((s, f) => s + f.valorCents, 0),
  };
}

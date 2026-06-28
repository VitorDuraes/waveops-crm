// src/lib/crm/metrics.test.ts — testes deterministicos das metricas de receita e funil.
// Fixtures com datas fixas (sem Date.now). MRR/churn/win rate sao regra critica: erro aqui
// destroi a confianca no dashboard, entao a cobertura e explicita e numerica.
import { describe, expect, it } from "vitest";
import {
  canceladasNoPeriodo,
  churnRatePercent,
  cicloMedioDias,
  computeArrCents,
  computeMrrCents,
  countAtivas,
  faturasVencidas,
  funnelByStage,
  novasNoPeriodo,
  perdasPorMotivo,
  pipelineAbertoCents,
  pipelinePonderadoCents,
  proximosVencimentos,
  recebidoNoPeriodo,
  winRatePercent,
  type AssinaturaMetric,
  type FaturaMetric,
  type OportunidadeMetric,
} from "./metrics";

const inicioMes = new Date("2026-06-01T00:00:00Z");
const proximoMes = new Date("2026-07-01T00:00:00Z");
const agora = new Date("2026-06-15T12:00:00Z");

const assinaturas: AssinaturaMetric[] = [
  { status: "ativo", valorMensalCents: 49700, dataInicio: new Date("2026-06-03T00:00:00Z"), canceladaEm: null },
  { status: "ativo", valorMensalCents: 99700, dataInicio: new Date("2026-05-20T00:00:00Z"), canceladaEm: null },
  { status: "pausado", valorMensalCents: 39700, dataInicio: new Date("2026-04-01T00:00:00Z"), canceladaEm: null },
  { status: "cancelado", valorMensalCents: 19900, dataInicio: new Date("2026-01-01T00:00:00Z"), canceladaEm: new Date("2026-06-10T00:00:00Z") },
  { status: "pendente", valorMensalCents: 49700, dataInicio: null, canceladaEm: null },
];

describe("receita recorrente", () => {
  it("MRR soma so as assinaturas ativas", () => {
    expect(computeMrrCents(assinaturas)).toBe(149400); // 49700 + 99700
  });

  it("MRR de lista vazia e zero", () => {
    expect(computeMrrCents([])).toBe(0);
  });

  it("ARR e MRR vezes 12", () => {
    expect(computeArrCents(149400)).toBe(1792800);
  });

  it("conta as ativas", () => {
    expect(countAtivas(assinaturas)).toBe(2);
  });

  it("novas no mes usam dataInicio dentro do periodo", () => {
    expect(novasNoPeriodo(assinaturas, inicioMes, proximoMes)).toBe(1); // so a de 03/06
  });

  it("canceladas no mes usam canceladaEm dentro do periodo", () => {
    expect(canceladasNoPeriodo(assinaturas, inicioMes, proximoMes)).toBe(1); // a de 10/06
  });

  it("churn = canceladas / (ativas + canceladas), em %", () => {
    // 1 / (2 + 1) = 33,3%
    expect(churnRatePercent(assinaturas, inicioMes, proximoMes)).toBe(33.3);
  });

  it("churn sem base e zero", () => {
    expect(churnRatePercent([], inicioMes, proximoMes)).toBe(0);
  });
});

const oportunidades: OportunidadeMetric[] = [
  { stage: "novo_lead", valorMensalEstimadoCents: 50000, probabilidade: 10, motivoDePerda: null, createdAt: new Date("2026-06-01T00:00:00Z"), updatedAt: new Date("2026-06-01T00:00:00Z") },
  { stage: "negociacao", valorMensalEstimadoCents: 100000, probabilidade: 60, motivoDePerda: null, createdAt: new Date("2026-06-01T00:00:00Z"), updatedAt: new Date("2026-06-05T00:00:00Z") },
  { stage: "ganho", valorMensalEstimadoCents: 80000, probabilidade: 100, motivoDePerda: null, createdAt: new Date("2026-06-01T00:00:00Z"), updatedAt: new Date("2026-06-11T00:00:00Z") },
  { stage: "ganho", valorMensalEstimadoCents: 40000, probabilidade: 100, motivoDePerda: null, createdAt: new Date("2026-06-01T00:00:00Z"), updatedAt: new Date("2026-06-21T00:00:00Z") },
  { stage: "perdido", valorMensalEstimadoCents: 30000, probabilidade: 0, motivoDePerda: "preco", createdAt: new Date("2026-06-01T00:00:00Z"), updatedAt: new Date("2026-06-08T00:00:00Z") },
  { stage: "perdido", valorMensalEstimadoCents: 20000, probabilidade: 0, motivoDePerda: "concorrente", createdAt: new Date("2026-06-01T00:00:00Z"), updatedAt: new Date("2026-06-09T00:00:00Z") },
];

describe("funil", () => {
  it("win rate = ganhos / (ganhos + perdidos)", () => {
    expect(winRatePercent(oportunidades)).toBe(50); // 2 / 4
  });

  it("win rate sem deals fechados e zero", () => {
    expect(winRatePercent([oportunidades[0]!])).toBe(0);
  });

  it("pipeline aberto soma so abertas", () => {
    expect(pipelineAbertoCents(oportunidades)).toBe(150000); // 50000 + 100000
  });

  it("pipeline ponderado usa a probabilidade", () => {
    expect(pipelinePonderadoCents(oportunidades)).toBe(65000); // 50000*.1 + 100000*.6
  });

  it("conversao por estagio conta e soma valor", () => {
    const buckets = funnelByStage(oportunidades, ["novo_lead", "negociacao", "ganho", "perdido"]);
    expect(buckets).toEqual([
      { stage: "novo_lead", count: 1, valorCents: 50000 },
      { stage: "negociacao", count: 1, valorCents: 100000 },
      { stage: "ganho", count: 2, valorCents: 120000 },
      { stage: "perdido", count: 2, valorCents: 50000 },
    ]);
  });

  it("perdas por motivo na ordem dada", () => {
    expect(perdasPorMotivo(oportunidades, ["preco", "concorrente", "outro"])).toEqual([
      { motivo: "preco", count: 1 },
      { motivo: "concorrente", count: 1 },
      { motivo: "outro", count: 0 },
    ]);
  });

  it("ciclo medio de venda em dias (ganhas)", () => {
    expect(cicloMedioDias(oportunidades)).toBe(15); // (10 + 20) / 2
  });

  it("ciclo medio nulo sem ganhas", () => {
    expect(cicloMedioDias([oportunidades[0]!])).toBeNull();
  });
});

const faturas: FaturaMetric[] = [
  { status: "vencida", valorCents: 49700, vencimento: new Date("2026-06-05T00:00:00Z"), pagoEm: null },
  { status: "em_aberto", valorCents: 99700, vencimento: new Date("2026-06-10T00:00:00Z"), pagoEm: null },
  { status: "em_aberto", valorCents: 39700, vencimento: new Date("2026-06-20T00:00:00Z"), pagoEm: null },
  { status: "criada", valorCents: 19900, vencimento: new Date("2026-06-30T00:00:00Z"), pagoEm: null },
  { status: "paga", valorCents: 49700, vencimento: new Date("2026-06-01T00:00:00Z"), pagoEm: new Date("2026-06-02T00:00:00Z") },
];

describe("cobranca", () => {
  it("vencidas = status vencida ou em aberto com vencimento passado", () => {
    expect(faturasVencidas(faturas, agora)).toEqual({ count: 2, totalCents: 149400 });
  });

  it("proximos vencimentos em aberto dentro da janela", () => {
    // janela de 7 dias a partir de 15/06 12h: pega a de 20/06 (39700), nao a de 30/06.
    expect(proximosVencimentos(faturas, agora, 7)).toEqual({ count: 1, totalCents: 39700 });
  });

  it("recebido no periodo soma as pagas com pagoEm no mes", () => {
    expect(recebidoNoPeriodo(faturas, inicioMes, proximoMes)).toEqual({ count: 1, totalCents: 49700 });
  });
});

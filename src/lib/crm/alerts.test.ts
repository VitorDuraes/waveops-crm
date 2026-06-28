// src/lib/crm/alerts.test.ts — testes deterministicos da deteccao de risco (churn antecipado).
import { describe, expect, it } from "vitest";
import {
  computeAlerts,
  type AssinaturaAlertInput,
  type FaturaAlertInput,
  type OportunidadeAlertInput,
} from "./alerts";

const now = new Date("2026-06-15T12:00:00Z");

const faturas: FaturaAlertInput[] = [
  { id: "f1", status: "vencida", vencimento: new Date("2026-06-05T00:00:00Z"), empresaId: "e1" },
  { id: "f2", status: "em_aberto", vencimento: new Date("2026-06-10T00:00:00Z"), empresaId: "e2" },
  { id: "f3", status: "em_aberto", vencimento: new Date("2026-06-20T00:00:00Z"), empresaId: "e1" },
  { id: "f4", status: "paga", vencimento: new Date("2026-06-01T00:00:00Z"), empresaId: "e1" },
];

const assinaturas: AssinaturaAlertInput[] = [
  { id: "a1", status: "ativo", proximoVencimento: new Date("2026-06-10T00:00:00Z"), empresaId: "e1" },
  { id: "a2", status: "vencido", proximoVencimento: new Date("2026-07-01T00:00:00Z"), empresaId: "e2" },
  { id: "a3", status: "ativo", proximoVencimento: new Date("2026-06-30T00:00:00Z"), empresaId: "e1" },
  { id: "a4", status: "pausado", proximoVencimento: new Date("2026-06-01T00:00:00Z"), empresaId: "e1" },
];

const oportunidades: OportunidadeAlertInput[] = [
  { id: "o1", name: "Deal A", stage: "negociacao", updatedAt: new Date("2026-05-20T00:00:00Z"), empresaId: "e1" },
  { id: "o2", name: "Deal B", stage: "novo_lead", updatedAt: new Date("2026-06-10T00:00:00Z"), empresaId: "e2" },
  { id: "o3", name: "Deal C", stage: "ganho", updatedAt: new Date("2026-05-01T00:00:00Z"), empresaId: "e1" },
  { id: "o4", name: "Deal D", stage: "perdido", updatedAt: new Date("2026-05-01T00:00:00Z"), empresaId: "e1" },
];

const empresaNames = { e1: "Alpha", e2: "Beta" };

function contaPorTipo(alertas: { tipo: string }[]) {
  return alertas.reduce<Record<string, number>>((acc, a) => {
    acc[a.tipo] = (acc[a.tipo] ?? 0) + 1;
    return acc;
  }, {});
}

describe("computeAlerts", () => {
  it("detecta fatura atrasada, assinatura vencida e lead parado", () => {
    const alertas = computeAlerts({ faturas, assinaturas, oportunidades, empresaNames, now });
    expect(contaPorTipo(alertas)).toEqual({
      fatura_atrasada: 2, // f1 vencida + f2 em aberto vencida
      assinatura_vencida: 2, // a1 ativa vencida + a2 status vencido
      lead_parado: 1, // o1 (open, parado ha mais de 14 dias)
    });
    expect(alertas).toHaveLength(5);
  });

  it("usa o nome da empresa na descricao", () => {
    const alertas = computeAlerts({ faturas, assinaturas, oportunidades, empresaNames, now });
    const f1 = alertas.find((a) => a.refId === "f1");
    expect(f1?.empresaName).toBe("Alpha");
    expect(f1?.descricao).toContain("Alpha");
  });

  it("respeita o limite de dias do lead parado", () => {
    // Com 30 dias, o1 (atualizado em 20/05, 26 dias antes) NAO conta mais.
    const alertas = computeAlerts({
      faturas,
      assinaturas,
      oportunidades,
      empresaNames,
      now,
      diasLeadParado: 30,
    });
    expect(contaPorTipo(alertas).lead_parado).toBeUndefined();
  });

  it("sem dados retorna lista vazia", () => {
    expect(
      computeAlerts({ faturas: [], assinaturas: [], oportunidades: [], empresaNames: {}, now }),
    ).toEqual([]);
  });
});

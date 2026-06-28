// src/lib/crm/alerts.ts — deteccao PURA de risco (sinais antecipados de churn). Sem banco, sem Date.now.
// Regras simples (sem ML): fatura atrasada, assinatura vencida, lead parado no funil.
// O repo src/server/alerts.ts busca as linhas e chama computeAlerts; "now" entra por parametro.
import type { TipoAlerta } from "@/lib/validators";

export type FaturaAlertInput = {
  id: string;
  status: string;
  vencimento: Date | null;
  empresaId: string;
};

export type AssinaturaAlertInput = {
  id: string;
  status: string;
  proximoVencimento: Date | null;
  empresaId: string;
};

export type OportunidadeAlertInput = {
  id: string;
  name: string;
  stage: string;
  updatedAt: Date;
  empresaId: string;
};

export type Alerta = {
  tipo: TipoAlerta;
  empresaId: string;
  empresaName: string;
  refId: string;
  descricao: string;
};

export type ComputeAlertsInput = {
  faturas: FaturaAlertInput[];
  assinaturas: AssinaturaAlertInput[];
  oportunidades: OportunidadeAlertInput[];
  empresaNames: Record<string, string>;
  now: Date;
  // Dias sem atualizacao para considerar um lead parado. Default 14.
  diasLeadParado?: number;
};

const passou = (d: Date | null, now: Date): boolean => d != null && d.getTime() < now.getTime();

export function computeAlerts(input: ComputeAlertsInput): Alerta[] {
  const { faturas, assinaturas, oportunidades, empresaNames, now } = input;
  const diasLeadParado = input.diasLeadParado ?? 14;
  const nome = (id: string) => empresaNames[id] ?? "Empresa";
  const alertas: Alerta[] = [];

  // 1. Fatura atrasada: status "vencida" ou em aberto com vencimento ja passado.
  for (const f of faturas) {
    const emAberto = f.status === "criada" || f.status === "em_aberto";
    if (f.status === "vencida" || (emAberto && passou(f.vencimento, now))) {
      alertas.push({
        tipo: "fatura_atrasada",
        empresaId: f.empresaId,
        empresaName: nome(f.empresaId),
        refId: f.id,
        descricao: `Fatura de ${nome(f.empresaId)} atrasada.`,
      });
    }
  }

  // 2. Assinatura vencida: status "vencido" ou ativa com proximo vencimento ja passado.
  for (const a of assinaturas) {
    if (a.status === "vencido" || (a.status === "ativo" && passou(a.proximoVencimento, now))) {
      alertas.push({
        tipo: "assinatura_vencida",
        empresaId: a.empresaId,
        empresaName: nome(a.empresaId),
        refId: a.id,
        descricao: `Assinatura de ${nome(a.empresaId)} vencida ou em atraso.`,
      });
    }
  }

  // 3. Lead parado: oportunidade aberta sem atualizacao ha mais de N dias.
  const limite = now.getTime() - diasLeadParado * 24 * 60 * 60 * 1000;
  for (const o of oportunidades) {
    const aberta = o.stage !== "ganho" && o.stage !== "perdido";
    if (aberta && o.updatedAt.getTime() < limite) {
      alertas.push({
        tipo: "lead_parado",
        empresaId: o.empresaId,
        empresaName: nome(o.empresaId),
        refId: o.id,
        descricao: `Oportunidade "${o.name}" parada ha mais de ${diasLeadParado} dias.`,
      });
    }
  }

  return alertas;
}

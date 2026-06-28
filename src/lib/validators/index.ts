// src/lib/validators/index.ts — fonte unica de verdade dos enums logicos do CRM e helpers puros.
// Os arrays abaixo espelham EXATAMENTE os CHECK das colunas em src/db/schema.ts.
// Devem permanecer identicos: schema e validators sao a mesma verdade em dois lugares.
// Labels PT-BR (value -> label) vivem em src/lib/crm/labels.ts.

// ---------- Papeis de usuario (users.role) ----------
export const ROLES = ["admin", "comercial", "financeiro", "suporte"] as const;
export type Role = (typeof ROLES)[number];

// ---------- Estagios do funil (oportunidades.stage) ----------
export const STAGE = [
  "novo_lead",
  "contato_feito",
  "diagnostico",
  "proposta_enviada",
  "negociacao",
  "ganho",
  "perdido",
] as const;
export type Stage = (typeof STAGE)[number];

// ---------- Status do cliente (empresas.status_do_cliente) ----------
export const STATUS_CLIENTE = [
  "lead",
  "aguardando",
  "ativo",
  "pendente",
  "vencido",
  "pausado",
  "cancelado",
] as const;
export type StatusCliente = (typeof STATUS_CLIENTE)[number];

// ---------- Segmento (empresas.segmento) ----------
export const SEGMENTO = [
  "comercial_vendas",
  "consultoria",
  "imobiliaria",
  "clinica_saude",
  "agencia_marketing",
  "ecommerce",
  "infoproduto",
  "escola_educacao",
  "time_suporte",
  "outro",
] as const;
export type Segmento = (typeof SEGMENTO)[number];

// ---------- Origem do lead (empresas.origem_do_lead) ----------
export const ORIGEM = [
  "site_formulario",
  "whatsapp",
  "indicacao",
  "outbound",
  "evento",
  "outro",
] as const;
export type Origem = (typeof ORIGEM)[number];

// ---------- Forma de pagamento (empresas.forma_de_pagamento) ----------
export const FORMA_PAGAMENTO = ["pix", "cartao", "boleto"] as const;
export type FormaPagamento = (typeof FORMA_PAGAMENTO)[number];

// ---------- Motivo de perda (oportunidades.motivo_de_perda) ----------
export const MOTIVO_PERDA = [
  "preco",
  "sem_fit",
  "sem_resposta",
  "concorrente",
  "timing",
  "outro",
] as const;
export type MotivoPerda = (typeof MOTIVO_PERDA)[number];

/**
 * Normaliza um telefone brasileiro para o formato so-digitos com DDI 55.
 * - Remove tudo que nao for digito.
 * - 10 ou 11 digitos (DDD + numero local) -> prefixa "55".
 * - Ja com DDI 55 e 12 ou 13 digitos -> mantem.
 * - Valido = 12 ou 13 digitos no fim. Caso contrario retorna null.
 * Saida alimenta as colunas *_normalized (UNIQUE parcial) para dedup.
 */
export function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Ja tem DDI 55 (55 + DDD(2) + numero(8 ou 9) = 12 ou 13 digitos).
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // DDD + numero local sem DDI (10 ou 11 digitos) -> prefixa 55.
  if (digits.length === 10 || digits.length === 11) {
    return "55" + digits;
  }
  return null;
}

/**
 * Normaliza um documento (CPF ou CNPJ) para a forma so-digitos.
 * Remove pontuacao e mascara. Vazio/sem digito -> null.
 * Saida alimenta empresas.documento (UNIQUE parcial) para dedup de cliente.
 */
export function normalizeDocumento(documento: string): string | null {
  if (!documento) return null;
  const digits = documento.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

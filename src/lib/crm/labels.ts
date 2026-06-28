// src/lib/crm/labels.ts — mapas value -> label PT-BR dos enums do CRM.
// Labels vindos de docs/specs/2026-06-23-waveops-crm-model.md (waveops-twenty-backbone).
// Os valores (chaves) espelham os arrays de src/lib/validators e os CHECK do schema.
// Use estes mapas em qualquer tela ou relatorio que o usuario le (nunca exibir o value cru).
import type {
  CanalFollowup,
  Ciclo,
  Fit,
  FormaPagamento,
  MotivoPerda,
  Origem,
  Plano,
  PrioridadeChamado,
  Role,
  Segmento,
  Stage,
  StatusAssinatura,
  StatusChamado,
  StatusCliente,
  StatusFatura,
  StatusFollowup,
  StatusProposta,
  TaskStatus,
  TipoAlerta,
  TipoFollowup,
} from "@/lib/validators";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  comercial: "Comercial",
  financeiro: "Financeiro",
  suporte: "Suporte",
};

export const STAGE_LABELS: Record<Stage, string> = {
  novo_lead: "Novo Lead",
  contato_feito: "Contato Feito",
  diagnostico: "Diagnóstico",
  proposta_enviada: "Proposta Enviada",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const STATUS_CLIENTE_LABELS: Record<StatusCliente, string> = {
  lead: "Lead",
  aguardando: "Aguardando",
  ativo: "Ativo",
  pendente: "Pendente",
  vencido: "Vencido",
  pausado: "Pausado",
  cancelado: "Cancelado",
};

export const SEGMENTO_LABELS: Record<Segmento, string> = {
  comercial_vendas: "Comercial/Vendas",
  consultoria: "Consultoria",
  imobiliaria: "Imobiliária",
  clinica_saude: "Clínica/Saúde",
  agencia_marketing: "Agência de Marketing",
  ecommerce: "E-commerce",
  infoproduto: "Infoproduto",
  escola_educacao: "Escola/Educação",
  time_suporte: "Time de Suporte",
  outro: "Outro",
};

export const ORIGEM_LABELS: Record<Origem, string> = {
  site_formulario: "Site/Formulário",
  whatsapp: "WhatsApp",
  indicacao: "Indicação",
  outbound: "Outbound",
  evento: "Evento",
  outro: "Outro",
};

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: "PIX",
  cartao: "Cartão",
  boleto: "Boleto",
};

export const MOTIVO_PERDA_LABELS: Record<MotivoPerda, string> = {
  preco: "Preço",
  sem_fit: "Sem Fit",
  sem_resposta: "Sem Resposta",
  concorrente: "Concorrente",
  timing: "Timing",
  outro: "Outro",
};

// ========================= Fase 2 (pre-venda + atividades) =========================

export const PLANO_LABELS: Record<Plano, string> = {
  operacao: "Operação",
  essencial: "Essencial",
  pro: "Pro",
  empresarial: "Empresarial",
};

export const FIT_LABELS: Record<Fit, string> = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
};

export const STATUS_PROPOSTA_LABELS: Record<StatusProposta, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em Andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

// ===================== Fase 3 (pos-venda, cobranca, receita) =====================

export const CICLO_LABELS: Record<Ciclo, string> = {
  mensal: "Mensal",
  anual: "Anual",
};

export const STATUS_ASSINATURA_LABELS: Record<StatusAssinatura, string> = {
  ativo: "Ativa",
  pendente: "Pendente",
  vencido: "Vencida",
  pausado: "Pausada",
  cancelado: "Cancelada",
};

export const STATUS_FATURA_LABELS: Record<StatusFatura, string> = {
  criada: "Criada",
  em_aberto: "Em aberto",
  paga: "Paga",
  vencida: "Vencida",
  cancelada: "Cancelada",
  estornada: "Estornada",
  reembolsada: "Reembolsada",
};

export const TIPO_FOLLOWUP_LABELS: Record<TipoFollowup, string> = {
  "7d_antes": "7 dias antes",
  "3d_antes": "3 dias antes",
  no_vencimento: "No vencimento",
  vencido_1: "Vencida +1 dia",
  vencido_3: "Vencida +3 dias",
  vencido_7: "Vencida +7 dias",
};

export const CANAL_FOLLOWUP_LABELS: Record<CanalFollowup, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  discord: "Discord",
};

export const STATUS_FOLLOWUP_LABELS: Record<StatusFollowup, string> = {
  agendado: "Agendado",
  enviado: "Enviado",
  falhou: "Falhou",
};

// ===================== Fase 4 (suporte e alertas) =====================

export const PRIORIDADE_CHAMADO_LABELS: Record<PrioridadeChamado, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const STATUS_CHAMADO_LABELS: Record<StatusChamado, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const TIPO_ALERTA_LABELS: Record<TipoAlerta, string> = {
  fatura_atrasada: "Fatura atrasada",
  assinatura_vencida: "Assinatura vencida",
  lead_parado: "Lead parado no funil",
};

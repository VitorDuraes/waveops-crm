// src/lib/crm/labels.ts — mapas value -> label PT-BR dos enums do CRM.
// Labels vindos de docs/specs/2026-06-23-waveops-crm-model.md (waveops-twenty-backbone).
// Os valores (chaves) espelham os arrays de src/lib/validators e os CHECK do schema.
// Use estes mapas em qualquer tela ou relatorio que o usuario le (nunca exibir o value cru).
import type {
  FormaPagamento,
  MotivoPerda,
  Origem,
  Role,
  Segmento,
  Stage,
  StatusCliente,
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

// src/db/schema.ts
// Esquema Drizzle do WaveOps CRM (MVP do funil de vendas).
// Fonte do modelo: docs/specs/2026-06-23-waveops-crm-model.md (waveops-twenty-backbone)
// e os seeders poc/model/seed-waveops-model.mjs / seed-waveops-sales.mjs.
// Convencao (igual ao WaveOps Prospect):
//  - Enums logicos sao CHECK em colunas text (NAO pgEnum), para evoluir sem migration de tipo.
//  - Os valores validos vivem tambem em src/lib/validators (STAGE, STATUS_CLIENTE, ...) e
//    DEVEM ser identicos aos CHECK abaixo (usamos os mesmos arrays para montar o SQL).
//  - Colunas snake_case; uuid pk defaultRandom; helpers createdAt/updatedAt com timezone.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  CANAL_FOLLOWUP,
  CICLO,
  FIT,
  FORMA_PAGAMENTO,
  MOTIVO_PERDA,
  ORIGEM,
  PLANO,
  PRIORIDADE_CHAMADO,
  ROLES,
  SEGMENTO,
  STAGE,
  STATUS_ASSINATURA,
  STATUS_CHAMADO,
  STATUS_CLIENTE,
  STATUS_FATURA,
  STATUS_FOLLOWUP,
  STATUS_PROPOSTA,
  TARGET_TYPE,
  TASK_STATUS,
  TIPO_FOLLOWUP,
} from "@/lib/validators";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

// Monta a lista `in ('a','b',...)` de um CHECK a partir do array de validators.
// Mantem schema e validators como a MESMA verdade.
const inList = (values: readonly string[]) =>
  sql.raw(`(${values.map((v) => `'${v}'`).join(",")})`);

// ---------- users ----------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("users_role_check", sql`${t.role} in ${inList(ROLES)}`)],
);

// ---------- empresas (espelha o Customer do portal / Company no Twenty) ----------
export const empresas = pgTable(
  "empresas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Documento normalizado (so digitos) para dedup. documentoDisplay guarda a forma mascarada.
    documento: text("documento"),
    documentoDisplay: text("documento_display"),
    statusDoCliente: text("status_do_cliente").notNull().default("lead"),
    segmento: text("segmento"),
    origemDoLead: text("origem_do_lead"),
    telefone: text("telefone"),
    telefoneNormalized: text("telefone_normalized"),
    website: text("website"),
    // Snapshot de billing (espelha os campos do Customer no portal).
    planoAtual: text("plano_atual"),
    valorMensalCents: integer("valor_mensal_cents"),
    formaDePagamento: text("forma_de_pagamento"),
    proximoVencimento: timestamp("proximo_vencimento", { withTimezone: true, mode: "date" }),
    ultimoPagamento: timestamp("ultimo_pagamento", { withTimezone: true, mode: "date" }),
    gatewayCustomerId: text("gateway_customer_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Dedup por documento e por telefone: unique parcial (NULL nao colide entre si).
    uniqueIndex("empresas_documento_unique")
      .on(t.documento)
      .where(sql`${t.documento} is not null`),
    uniqueIndex("empresas_telefone_normalized_unique")
      .on(t.telefoneNormalized)
      .where(sql`${t.telefoneNormalized} is not null`),
    check("empresas_status_do_cliente_check", sql`${t.statusDoCliente} in ${inList(STATUS_CLIENTE)}`),
    check(
      "empresas_segmento_check",
      sql`${t.segmento} is null or ${t.segmento} in ${inList(SEGMENTO)}`,
    ),
    check(
      "empresas_origem_do_lead_check",
      sql`${t.origemDoLead} is null or ${t.origemDoLead} in ${inList(ORIGEM)}`,
    ),
    check(
      "empresas_forma_de_pagamento_check",
      sql`${t.formaDePagamento} is null or ${t.formaDePagamento} in ${inList(FORMA_PAGAMENTO)}`,
    ),
  ],
);

// ---------- pessoas (contato; espelha a Person no Twenty) ----------
export const pessoas = pgTable("pessoas", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  phoneNormalized: text("phone_normalized"),
  documento: text("documento"),
  // Contato pertence a uma empresa. Empresa apagada -> contato fica orfao (set null), nao some.
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- oportunidades (negocio no funil; Opportunity no Twenty) ----------
export const oportunidades = pgTable(
  "oportunidades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    stage: text("stage").notNull().default("novo_lead"),
    // Oportunidade pertence a uma empresa (obrigatorio). Empresa apagada -> oportunidade cai junto.
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    // Contato opcional ligado a oportunidade. Contato apagado -> oportunidade mantida (set null).
    pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    planoPretendido: text("plano_pretendido"),
    valorMensalEstimadoCents: integer("valor_mensal_estimado_cents"),
    probabilidade: integer("probabilidade"),
    motivoDePerda: text("motivo_de_perda"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("oportunidades_stage_created_idx").on(t.stage, t.createdAt),
    check("oportunidades_stage_check", sql`${t.stage} in ${inList(STAGE)}`),
    check(
      "oportunidades_motivo_de_perda_check",
      sql`${t.motivoDePerda} is null or ${t.motivoDePerda} in ${inList(MOTIVO_PERDA)}`,
    ),
    check(
      "oportunidades_probabilidade_check",
      sql`${t.probabilidade} is null or (${t.probabilidade} >= 0 and ${t.probabilidade} <= 100)`,
    ),
  ],
);

// ========================= Fase 2 (pre-venda + atividades) =========================

// ---------- diagnosticos (qualificacao do deal; fit Alto/Medio/Baixo) ----------
export const diagnosticos = pgTable(
  "diagnosticos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dor: text("dor"),
    processoAtual: text("processo_atual"),
    ferramentas: text("ferramentas"),
    volume: text("volume"),
    fit: text("fit"),
    // Pertence a uma oportunidade (e, por consequencia, a uma empresa). Cascade junto.
    oportunidadeId: uuid("oportunidade_id")
      .notNull()
      .references(() => oportunidades.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("diagnosticos_oportunidade_idx").on(t.oportunidadeId),
    check("diagnosticos_fit_check", sql`${t.fit} is null or ${t.fit} in ${inList(FIT)}`),
  ],
);

// ---------- propostas (proposta comercial ligada a oportunidade) ----------
export const propostas = pgTable(
  "propostas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    plano: text("plano"),
    valorMensalCents: integer("valor_mensal_cents"),
    valorSetupCents: integer("valor_setup_cents"),
    escopo: text("escopo"),
    status: text("status").notNull().default("rascunho"),
    dataEnvio: timestamp("data_envio", { withTimezone: true, mode: "date" }),
    validade: timestamp("validade", { withTimezone: true, mode: "date" }),
    link: text("link"),
    oportunidadeId: uuid("oportunidade_id")
      .notNull()
      .references(() => oportunidades.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("propostas_status_created_idx").on(t.status, t.createdAt),
    index("propostas_oportunidade_idx").on(t.oportunidadeId),
    check("propostas_status_check", sql`${t.status} in ${inList(STATUS_PROPOSTA)}`),
    check("propostas_plano_check", sql`${t.plano} is null or ${t.plano} in ${inList(PLANO)}`),
  ],
);

// ---------- notes (anotacao vinculavel a qualquer registro via targetType+targetId) ----------
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    body: text("body").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    // Autor da nota. Usuario apagado -> nota mantida (set null).
    autorId: uuid("autor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("notes_target_idx").on(t.targetType, t.targetId),
    check("notes_target_type_check", sql`${t.targetType} in ${inList(TARGET_TYPE)}`),
  ],
);

// ---------- tasks (to-do vinculavel a qualquer registro) ----------
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    status: text("status").notNull().default("aberta"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    autorId: uuid("autor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tasks_target_idx").on(t.targetType, t.targetId),
    index("tasks_status_idx").on(t.status),
    check("tasks_status_check", sql`${t.status} in ${inList(TASK_STATUS)}`),
    check("tasks_target_type_check", sql`${t.targetType} in ${inList(TARGET_TYPE)}`),
  ],
);

// ---------- audit_log (append-only; alimenta a timeline da record page e o compliance) ----------
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Quem fez a acao. Acao do sistema (ingestao) pode ter actor null.
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    acao: text("acao").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: uuid("entidade_id").notNull(),
    antes: jsonb("antes"),
    depois: jsonb("depois"),
    // Append-only: so existe o instante do evento, nunca updatedAt.
    at: timestamp("at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_entidade_idx").on(t.entidade, t.entidadeId, t.at)],
);

// ===================== Fase 3 (pos-venda, cobranca, receita) =====================

// ---------- planos (catalogo de planos WaveOps; 4 seedados) ----------
export const planos = pgTable(
  "planos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    descricao: text("descricao"),
    precoMensalCents: integer("preco_mensal_cents").notNull(),
    ciclo: text("ciclo").notNull().default("mensal"),
    // null = ilimitado.
    maxAutomacoes: integer("max_automacoes"),
    nivelDeSuporte: text("nivel_de_suporte"),
    ativo: boolean("ativo").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("planos_ciclo_check", sql`${t.ciclo} in ${inList(CICLO)}`)],
);

// ---------- assinaturas (vinculo Empresa<->Plano; fonte primaria do MRR) ----------
export const assinaturas = pgTable(
  "assinaturas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    status: text("status").notNull().default("pendente"),
    // Snapshot do valor mensal no momento da assinatura (em centavos). MRR = soma das ativas.
    valorMensalCents: integer("valor_mensal_cents").notNull(),
    dataInicio: timestamp("data_inicio", { withTimezone: true, mode: "date" }),
    proximoVencimento: timestamp("proximo_vencimento", { withTimezone: true, mode: "date" }),
    canceladaEm: timestamp("cancelada_em", { withTimezone: true, mode: "date" }),
    pausadaEm: timestamp("pausada_em", { withTimezone: true, mode: "date" }),
    gatewaySubscriptionId: text("gateway_subscription_id"),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    // Plano apagado nao mata a assinatura (snapshot de valor ja preservado).
    planoId: uuid("plano_id").references(() => planos.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("assinaturas_status_idx").on(t.status),
    index("assinaturas_empresa_idx").on(t.empresaId),
    check("assinaturas_status_check", sql`${t.status} in ${inList(STATUS_ASSINATURA)}`),
    check("assinaturas_valor_check", sql`${t.valorMensalCents} > 0`),
  ],
);

// ---------- faturas (cobranca de uma assinatura/empresa) ----------
export const faturas = pgTable(
  "faturas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    valorCents: integer("valor_cents").notNull(),
    vencimento: timestamp("vencimento", { withTimezone: true, mode: "date" }),
    pagoEm: timestamp("pago_em", { withTimezone: true, mode: "date" }),
    status: text("status").notNull().default("em_aberto"),
    formaPagamento: text("forma_pagamento"),
    linkDePagamento: text("link_de_pagamento"),
    gatewayPaymentId: text("gateway_payment_id"),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    assinaturaId: uuid("assinatura_id").references(() => assinaturas.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("faturas_status_vencimento_idx").on(t.status, t.vencimento),
    index("faturas_empresa_idx").on(t.empresaId),
    check("faturas_status_check", sql`${t.status} in ${inList(STATUS_FATURA)}`),
    check("faturas_valor_check", sql`${t.valorCents} > 0`),
    check(
      "faturas_forma_pagamento_check",
      sql`${t.formaPagamento} is null or ${t.formaPagamento} in ${inList(FORMA_PAGAMENTO)}`,
    ),
  ],
);

// ---------- followups (regua de cobranca por fatura) ----------
export const followups = pgTable(
  "followups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    tipo: text("tipo").notNull(),
    canal: text("canal").notNull().default("whatsapp"),
    mensagem: text("mensagem"),
    status: text("status").notNull().default("agendado"),
    agendadoPara: timestamp("agendado_para", { withTimezone: true, mode: "date" }),
    enviadoEm: timestamp("enviado_em", { withTimezone: true, mode: "date" }),
    erro: text("erro"),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    faturaId: uuid("fatura_id").references(() => faturas.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("followups_status_idx").on(t.status),
    check("followups_tipo_check", sql`${t.tipo} in ${inList(TIPO_FOLLOWUP)}`),
    check("followups_canal_check", sql`${t.canal} in ${inList(CANAL_FOLLOWUP)}`),
    check("followups_status_check", sql`${t.status} in ${inList(STATUS_FOLLOWUP)}`),
  ],
);

// ===================== Fase 4 (suporte e alertas) =====================

// ---------- chamados (suporte; abertos pelo cliente no Portal ou pelo time) ----------
export const chamados = pgTable(
  "chamados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    prioridade: text("prioridade").notNull().default("media"),
    status: text("status").notNull().default("aberto"),
    trelloCardId: text("trello_card_id"),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("chamados_status_idx").on(t.status),
    index("chamados_empresa_idx").on(t.empresaId),
    check("chamados_prioridade_check", sql`${t.prioridade} in ${inList(PRIORIDADE_CHAMADO)}`),
    check("chamados_status_check", sql`${t.status} in ${inList(STATUS_CHAMADO)}`),
  ],
);

// ---------- briefings (1 por empresa; onboarding/escopo do cliente) ----------
export const briefings = pgTable(
  "briefings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    objetivo: text("objetivo"),
    ferramentaAtual: text("ferramenta_atual"),
    dor: text("dor"),
    volume: text("volume"),
    trelloCardId: text("trello_card_id"),
    // Regra de negocio: 1 briefing por empresa (upsert por empresa_id).
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("briefings_empresa_unique").on(t.empresaId)],
);

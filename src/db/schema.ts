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
  FIT,
  FORMA_PAGAMENTO,
  MOTIVO_PERDA,
  ORIGEM,
  PLANO,
  ROLES,
  SEGMENTO,
  STAGE,
  STATUS_CLIENTE,
  STATUS_PROPOSTA,
  TARGET_TYPE,
  TASK_STATUS,
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

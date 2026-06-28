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
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  FORMA_PAGAMENTO,
  MOTIVO_PERDA,
  ORIGEM,
  ROLES,
  SEGMENTO,
  STAGE,
  STATUS_CLIENTE,
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

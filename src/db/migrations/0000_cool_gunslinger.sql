CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"documento" text,
	"documento_display" text,
	"status_do_cliente" text DEFAULT 'lead' NOT NULL,
	"segmento" text,
	"origem_do_lead" text,
	"telefone" text,
	"telefone_normalized" text,
	"website" text,
	"plano_atual" text,
	"valor_mensal_cents" integer,
	"forma_de_pagamento" text,
	"proximo_vencimento" timestamp with time zone,
	"ultimo_pagamento" timestamp with time zone,
	"gateway_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresas_status_do_cliente_check" CHECK ("empresas"."status_do_cliente" in ('lead','aguardando','ativo','pendente','vencido','pausado','cancelado')),
	CONSTRAINT "empresas_segmento_check" CHECK ("empresas"."segmento" is null or "empresas"."segmento" in ('comercial_vendas','consultoria','imobiliaria','clinica_saude','agencia_marketing','ecommerce','infoproduto','escola_educacao','time_suporte','outro')),
	CONSTRAINT "empresas_origem_do_lead_check" CHECK ("empresas"."origem_do_lead" is null or "empresas"."origem_do_lead" in ('site_formulario','whatsapp','indicacao','outbound','evento','outro')),
	CONSTRAINT "empresas_forma_de_pagamento_check" CHECK ("empresas"."forma_de_pagamento" is null or "empresas"."forma_de_pagamento" in ('pix','cartao','boleto'))
);
--> statement-breakpoint
CREATE TABLE "oportunidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"stage" text DEFAULT 'novo_lead' NOT NULL,
	"empresa_id" uuid NOT NULL,
	"pessoa_id" uuid,
	"plano_pretendido" text,
	"valor_mensal_estimado_cents" integer,
	"probabilidade" integer,
	"motivo_de_perda" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oportunidades_stage_check" CHECK ("oportunidades"."stage" in ('novo_lead','contato_feito','diagnostico','proposta_enviada','negociacao','ganho','perdido')),
	CONSTRAINT "oportunidades_motivo_de_perda_check" CHECK ("oportunidades"."motivo_de_perda" is null or "oportunidades"."motivo_de_perda" in ('preco','sem_fit','sem_resposta','concorrente','timing','outro')),
	CONSTRAINT "oportunidades_probabilidade_check" CHECK ("oportunidades"."probabilidade" is null or ("oportunidades"."probabilidade" >= 0 and "oportunidades"."probabilidade" <= 100))
);
--> statement-breakpoint
CREATE TABLE "pessoas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"email" text,
	"phone" text,
	"phone_normalized" text,
	"documento" text,
	"empresa_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('admin','comercial','financeiro','suporte'))
);
--> statement-breakpoint
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "empresas_documento_unique" ON "empresas" USING btree ("documento") WHERE "empresas"."documento" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "empresas_telefone_normalized_unique" ON "empresas" USING btree ("telefone_normalized") WHERE "empresas"."telefone_normalized" is not null;--> statement-breakpoint
CREATE INDEX "oportunidades_stage_created_idx" ON "oportunidades" USING btree ("stage","created_at");
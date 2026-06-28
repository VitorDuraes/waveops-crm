CREATE TABLE "assinaturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"valor_mensal_cents" integer NOT NULL,
	"data_inicio" timestamp with time zone,
	"proximo_vencimento" timestamp with time zone,
	"cancelada_em" timestamp with time zone,
	"pausada_em" timestamp with time zone,
	"gateway_subscription_id" text,
	"empresa_id" uuid NOT NULL,
	"plano_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assinaturas_status_check" CHECK ("assinaturas"."status" in ('ativo','pendente','vencido','pausado','cancelado'))
);
--> statement-breakpoint
CREATE TABLE "faturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"valor_cents" integer NOT NULL,
	"vencimento" timestamp with time zone,
	"pago_em" timestamp with time zone,
	"status" text DEFAULT 'em_aberto' NOT NULL,
	"forma_pagamento" text,
	"link_de_pagamento" text,
	"gateway_payment_id" text,
	"empresa_id" uuid NOT NULL,
	"assinatura_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faturas_status_check" CHECK ("faturas"."status" in ('criada','em_aberto','paga','vencida','cancelada','estornada','reembolsada')),
	CONSTRAINT "faturas_forma_pagamento_check" CHECK ("faturas"."forma_pagamento" is null or "faturas"."forma_pagamento" in ('pix','cartao','boleto'))
);
--> statement-breakpoint
CREATE TABLE "followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"tipo" text NOT NULL,
	"canal" text DEFAULT 'whatsapp' NOT NULL,
	"mensagem" text,
	"status" text DEFAULT 'agendado' NOT NULL,
	"agendado_para" timestamp with time zone,
	"enviado_em" timestamp with time zone,
	"erro" text,
	"empresa_id" uuid NOT NULL,
	"fatura_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "followups_tipo_check" CHECK ("followups"."tipo" in ('7d_antes','3d_antes','no_vencimento','vencido_1','vencido_3','vencido_7')),
	CONSTRAINT "followups_canal_check" CHECK ("followups"."canal" in ('whatsapp','email','discord')),
	CONSTRAINT "followups_status_check" CHECK ("followups"."status" in ('agendado','enviado','falhou'))
);
--> statement-breakpoint
CREATE TABLE "planos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"descricao" text,
	"preco_mensal_cents" integer NOT NULL,
	"ciclo" text DEFAULT 'mensal' NOT NULL,
	"max_automacoes" integer,
	"nivel_de_suporte" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planos_ciclo_check" CHECK ("planos"."ciclo" in ('mensal','anual'))
);
--> statement-breakpoint
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_plano_id_planos_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_assinatura_id_assinaturas_id_fk" FOREIGN KEY ("assinatura_id") REFERENCES "public"."assinaturas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_fatura_id_faturas_id_fk" FOREIGN KEY ("fatura_id") REFERENCES "public"."faturas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assinaturas_status_idx" ON "assinaturas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assinaturas_empresa_idx" ON "assinaturas" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "faturas_status_vencimento_idx" ON "faturas" USING btree ("status","vencimento");--> statement-breakpoint
CREATE INDEX "faturas_empresa_idx" ON "faturas" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "followups_status_idx" ON "followups" USING btree ("status");
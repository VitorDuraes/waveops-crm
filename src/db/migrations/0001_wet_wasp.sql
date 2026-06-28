CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid NOT NULL,
	"antes" jsonb,
	"depois" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnosticos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dor" text,
	"processo_atual" text,
	"ferramentas" text,
	"volume" text,
	"fit" text,
	"oportunidade_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diagnosticos_fit_check" CHECK ("diagnosticos"."fit" is null or "diagnosticos"."fit" in ('alto','medio','baixo'))
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"body" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"autor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_target_type_check" CHECK ("notes"."target_type" in ('empresa','pessoa','oportunidade','proposta','diagnostico'))
);
--> statement-breakpoint
CREATE TABLE "propostas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"plano" text,
	"valor_mensal_cents" integer,
	"valor_setup_cents" integer,
	"escopo" text,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"data_envio" timestamp with time zone,
	"validade" timestamp with time zone,
	"link" text,
	"oportunidade_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "propostas_status_check" CHECK ("propostas"."status" in ('rascunho','enviada','aceita','recusada','expirada')),
	CONSTRAINT "propostas_plano_check" CHECK ("propostas"."plano" is null or "propostas"."plano" in ('operacao','essencial','pro','empresarial'))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'aberta' NOT NULL,
	"due_at" timestamp with time zone,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"autor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" in ('aberta','em_andamento','concluida','cancelada')),
	CONSTRAINT "tasks_target_type_check" CHECK ("tasks"."target_type" in ('empresa','pessoa','oportunidade','proposta','diagnostico'))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosticos" ADD CONSTRAINT "diagnosticos_oportunidade_id_oportunidades_id_fk" FOREIGN KEY ("oportunidade_id") REFERENCES "public"."oportunidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosticos" ADD CONSTRAINT "diagnosticos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_oportunidade_id_oportunidades_id_fk" FOREIGN KEY ("oportunidade_id") REFERENCES "public"."oportunidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entidade_idx" ON "audit_log" USING btree ("entidade","entidade_id","at");--> statement-breakpoint
CREATE INDEX "diagnosticos_oportunidade_idx" ON "diagnosticos" USING btree ("oportunidade_id");--> statement-breakpoint
CREATE INDEX "notes_target_idx" ON "notes" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "propostas_status_created_idx" ON "propostas" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "propostas_oportunidade_idx" ON "propostas" USING btree ("oportunidade_id");--> statement-breakpoint
CREATE INDEX "tasks_target_idx" ON "tasks" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");
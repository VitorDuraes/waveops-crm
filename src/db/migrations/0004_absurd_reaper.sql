CREATE TABLE "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objetivo" text,
	"ferramenta_atual" text,
	"dor" text,
	"volume" text,
	"trello_card_id" text,
	"empresa_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chamados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"prioridade" text DEFAULT 'media' NOT NULL,
	"status" text DEFAULT 'aberto' NOT NULL,
	"trello_card_id" text,
	"empresa_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chamados_prioridade_check" CHECK ("chamados"."prioridade" in ('baixa','media','alta')),
	CONSTRAINT "chamados_status_check" CHECK ("chamados"."status" in ('aberto','em_andamento','resolvido','fechado'))
);
--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "briefings_empresa_unique" ON "briefings" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "chamados_status_idx" ON "chamados" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chamados_empresa_idx" ON "chamados" USING btree ("empresa_id");
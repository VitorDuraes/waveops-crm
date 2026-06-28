# Spec: CRM proprio WaveOps (estilo Twenty + Datacrazy)

- Data: 2026-06-28
- Status geral: DEFINIDO (escopo pragmatico aprovado), implementacao em fases
- Base: este repo (WaveOps-CRM). Fonte do modelo: `docs/specs/2026-06-23-waveops-crm-model.md` (backbone) e seeders `poc/model/*.mjs`.
- Decisao registrada: memoria de projeto `waveops-crm-proprio` (2026-06-28).

## Contexto

A WaveOps vende automacao por assinatura mensal. O trajeto do negocio: prospeccao (lead frio) -> funil de vendas -> cliente em assinatura (MRR) -> suporte e sucesso -> dashboards de receita recorrente. O CRM proprio cobre esse trajeto inteiro, na stack WaveOps, sem custo por assento e sem dependencia do Twenty.

Twenty entra como REFERENCIA de ergonomia (objetos, kanban, record page com timeline). Datacrazy entra como referencia de numeros (funil em tempo real, win rate, ciclo). O diferencial sobre o Datacrazy e o que ele NAO entrega e que e o coracao de quem cobra recorrente: MRR/ARR, churn e cohort.

## Objetivo

Entregar, em fases, um CRM operacional + inteligencia de receita que substitua o uso do Twenty para o nucleo de vendas e pos-venda da WaveOps.

## Escopo (DEFINIDO)

- Entidades fixas bem feitas em Drizzle, enums via CHECK sincronizados aos validators (padrao ja em uso).
- Funil de Oportunidades (kanban, drag-and-drop nativo) e gestao de Empresas/Pessoas. JA EXISTE (Fase 1).
- Pre-venda: Diagnostico (qualificacao/fit) e Proposta (status, valores, validade).
- Atividades: Notes e Tasks vinculaveis a qualquer registro; timeline via log de auditoria append-only.
- Pos-venda e cobranca: Plano, Assinatura, Fatura, Follow-up (regua de cobranca).
- Dashboards: MRR/ARR e crescimento liquido, conversao por estagio, win rate por origem, ciclo de venda, motivo de perda, pipeline ponderado, cohort e churn.
- Suporte: Chamado e Briefing.
- Busca global, filtros compostos, saved views, import/export CSV com preview, bulk actions.
- API REST de ingestao por Bearer token (timing-safe), idempotente, com dedup. JA EXISTE para lead.
- Campos customizaveis SIMPLES via JSONB + registry de tipos em codigo (meio-termo, fase later).

## Fora de escopo (FORA DE ESCOPO, com substituto)

- Engine de metadados dinamico do Twenty (criar objeto/campo pela UI gerando schema/DDL/API em runtime). Substituto: entidades fixas + JSONB/registry.
- Multi-workspace por schema Postgres por tenant. Substituto: uso interno, um workspace.
- Geracao automatica de API por workspace. Substituto: API escrita a mao sobre entidades fixas.
- Permissoes field-level. Substituto: object-level por papel na DAL.
- Sync two-way de e-mail/agenda (Gmail/Outlook/IMAP/CalDAV). Substituto: WhatsApp (canal real do Brasil), fase later.
- Workflow engine no-code com serverless functions (CVE de RCE no Twenty). Substituto: n8n externo.
- ML de scoring/forecast/churn prediction e conversation intelligence. Substituto: pipeline ponderado por estagio e alertas por regra.
- Relacao polimorfica generica com traversal. Substituto: FK explicita; Notes/Tasks usam (targetType, targetId) simples.
- Disparo automatizado de WhatsApp em massa (risco de ban ToS). CS reativo.

## Stack (DEFINIDO)

Next.js 16 App Router + TypeScript strict, Drizzle ORM + PostgreSQL, auth de sessao propria (jose JWT HS256 + bcrypt) com 4 papeis (admin, comercial, financeiro, suporte) barrados na DAL, Tailwind, Vitest, npm. Backend em Server Actions e Route Handlers. `proxy.ts` otimista, DAL e a barreira real. Segredo server-only. Enums por CHECK sincronizados a validators. Repo pattern: funcoes puras recebem `db` por injecao (DbOrTx), retornam discriminated unions. CURRENCY em centavos. Deploy: Railway (Hobby pago, Postgres gerenciado, conexao direta), migrations via `scripts/migrate.mjs` no preDeploy. Kanban drag-and-drop nativo HTML5, sem dnd-kit. Sem Shadcn. Dashboards em SQL agregado sobre Postgres. Automacao pesada no n8n. Drivers DISABLED, nunca logic functions in-process.

## Entidades core

Ja existem: User, Empresa, Pessoa, Oportunidade (ver `src/db/schema.ts`).

A adicionar por fase:
- Fase 2: Diagnostico (dor, processo, ferramentas, volume, fit Alto/Medio/Baixo; FK Oportunidade+Empresa). Proposta (plano, valorMensalCents, valorSetupCents, escopo, status Rascunho/Enviada/Aceita/Recusada/Expirada, dataEnvio, validade, link; FK Oportunidade+Empresa). Note e Task (targetType+targetId, autorId). AuditLog (actorId, acao, entidade, entidadeId, antes/depois JSONB, at append-only).
- Fase 3: Plano (precoMensalCents, ciclo, ativo; 4 ja seedados). Assinatura (status, dataInicio, proximoVencimento, FK Empresa+Plano). Fatura (valorCents, vencimento, pagoEm, status, formaPagamento, FK Empresa+Assinatura). Follow-up (tipo da regua, canal, mensagem, status; FK Empresa+Fatura).
- Fase 4: Chamado (titulo, descricao, prioridade, status; FK Empresa). Briefing (objetivo, ferramentaAtual, dor, volume; 1 por Empresa). customFields JSONB por entidade core.

## Roadmap

### Fase 1: MVP (funil + empresas + ingestao) — CONCLUIDA
Ja no ar no Railway. Auth + 4 papeis, schema core, Kanban do funil, tabela de Empresas, API de ingestao de lead, testes, deploy. Pendencia operacional: seed do admin no banco de producao.

### Fase 2: pre-venda + atividades — PROXIMA
Goal: ciclo comercial fechado, com qualificacao, proposta e historico por registro.
Entregaveis:
1. Schema + migration de Diagnostico, Proposta, Note, Task, AuditLog. Validators novos (FIT, STATUS_PROPOSTA, PLANO, TIPO_NOTE/TASK).
2. Repos (diagnosticos, propostas, notes, tasks, audit) no padrao DbOrTx + discriminated unions.
3. Helper de auditoria append-only chamado nas acoes comerciais (mudanca de estagio, criacao, edicao).
4. Tela `/propostas` (kanban por status). Record pages `/empresas/[id]` e `/oportunidades/[id]` com relacionados e timeline.
5. Busca global (Empresa, Pessoa, Oportunidade) e filtros compostos basicos.
6. Testes Vitest das regras (transicao de estagio, fit, status de proposta, auditoria). Gates lint/build/test verdes.
DependsOn: Fase 1.

### Fase 3: pos-venda + cobranca + dashboards de receita
Goal: MRR e saude do funil mensuraveis. O diferencial sobre o Datacrazy.
Entregaveis: schema+telas de Plano/Assinatura/Fatura/Follow-up; `/cobranca`; `/dashboards` (MRR/ARR, crescimento liquido, conversao por estagio, win rate por origem, ciclo de venda, motivo de perda, pipeline ponderado); cohort e curva de churn em SQL; saved views, export/import CSV com preview, bulk actions; ligar o Portal ao CRM. Testes dos calculos de MRR/churn/conversao com fixtures deterministicas.
DependsOn: Fase 2 e Fase 1. Assinatura/Fatura sao pre-requisito do MRR.

### Fase 4: suporte + WhatsApp + alertas + campos custom
Goal: CS atendendo pelo WhatsApp com tudo registrado e sinais antecipados de churn.
Entregaveis: schema+telas de Chamado e Briefing; `/chamados`; inbox `/inbox` de WhatsApp via Evolution (inbound vira Empresa+Pessoa+Note, dedup); alertas por regra (cliente inativo, fatura atrasada, lead parado); campos customizaveis JSONB+registry; cron idempotente. Testes dos alertas e dedup.
DependsOn: Fase 3 e Fase 1. Bloqueado por chip dedicado + pareamento (decisao do dono).

## Riscos (DEFINIDO mitigar)

- Re-escopo para o engine dinamico do Twenty: fronteira dura (entidades fixas + JSONB/registry; campo novo via migration ate prova de necessidade).
- MRR/churn errados: definir MRR (o que conta como ativo, pausado, anual normalizado, expansao vs contracao) em spec antes do codigo, com testes deterministicos.
- Acoplamento Prospect/Portal pela API: versionar endpoint, manter contrato, idempotencia e dedup.
- WhatsApp nao oficial: numero dedicado, baixo volume, reativo, isolavel, fase later.
- CVE de logic functions: nao portar serverless; automacao no n8n.
- LGPD: PII real, base legal, opt-out, supressao, caminho de exclusao; preview antes de gravar; nao logar PII crua.
- Retencao do audit_log: e append-only e guarda snapshot financeiro (valorCents, status) em jsonb, sem FK para empresa, entao sobrevive ao cascade. INDEFINIDO: definir politica de retencao e caminho de expurgo/anonimizacao por entidade quando a empresa for excluida. Nao bloqueia a Fase 3; resolver no spec de privacidade da Fase 4 (junto com mascarar CPF e base legal do contato).
- Time pequeno: cada fase entrega valor sozinha; nao empilhar should/later no MVP.

## Criterios de aceite (por fase)

- Fase 2: comercial registra Diagnostico e Proposta; record page mostra timeline real do AuditLog; busca encontra Empresa/Pessoa/Oportunidade; gates verdes.
- Fase 3: dashboard mostra MRR correto (validado por fixtures), conversao por estagio e churn; cobranca lista vencidas e proximas; Portal alimenta o CRM.
- Fase 4: chamado/briefing do Portal aparecem no CRM; WhatsApp inbound vira registro; alertas disparam por regra.

# WaveOps CRM - status de implementacao

CRM proprio da WaveOps (estilo Twenty + Datacrazy) na stack WaveOps: Next.js 16 App Router,
TypeScript strict, Drizzle ORM, PostgreSQL, auth de sessao propria (jose + bcrypt), Tailwind, Vitest.
Spec: `docs/specs/2026-06-28-crm-proprio.md`. Deploy: Railway (`DEPLOY-RAILWAY.md`).

## Fases entregues

### Fase 1: MVP (funil + empresas + ingestao)
Auth + 4 papeis (admin, comercial, financeiro, suporte) barrados na DAL. Schema core
(Empresa, Pessoa, Oportunidade). Kanban do funil (drag-and-drop nativo). Lista de Empresas
com dedup por documento/telefone. API de ingestao `POST /api/ingest/lead` (Bearer token).

### Fase 2: pre-venda + atividades
Diagnostico, Proposta (kanban por status), Notes e Tasks vinculaveis a qualquer registro,
AuditLog append-only alimentando a timeline. Record pages de Empresa e Oportunidade. Busca global.

### Fase 3: pos-venda + cobranca + dashboards de receita
Plano (4 seedados), Assinatura (snapshot de MRR), Fatura, Follow-up. Tela `/cobranca`.
Tela `/dashboards`: MRR/ARR, crescimento liquido, churn, win rate, ciclo de venda, pipeline
ponderado, motivo de perda, faturas vencidas e recebido no mes. Metricas como funcoes PURAS
(`src/lib/crm/metrics.ts`) com testes deterministicos.

### Fase 4: suporte + alertas de risco
Chamado e Briefing (1 por empresa). Tela `/chamados`. Tela `/alertas` com deteccao de risco
(churn antecipado) por regra: fatura atrasada, assinatura vencida, lead parado no funil
(`src/lib/crm/alerts.ts`, puro e testado). Suporte e Briefing na record page de Empresa.

## Rotas
`/` `/login` `/dashboards` `/funil` `/propostas` `/empresas` `/empresas/[id]` `/oportunidades/[id]`
`/cobranca` `/chamados` `/alertas` `/buscar` `/api/health` `/api/ingest/lead`.

## Qualidade
Gates verdes em cada fase: `npm run lint`, `npm run build`, `npm test` (132 testes), `tsc --noEmit`.
Revisao adversarial multi-agente por fase (correcao, seguranca/LGPD, convencoes/PT-BR).
Migrations versionadas: `0000` a `0004`. Aplicam sozinhas no deploy (`scripts/migrate.mjs`).

## Adiado (later) - decisoes documentadas

- **WhatsApp inbox (CS)**: precisa de chip dedicado + Evolution API (decisao de hardware do dono).
  Risco de ban por ToS, por isso fica isolado e fora do caminho critico.
- **Campos customizaveis (JSONB + registry)**: meio-termo pragmatico ao engine do Twenty.
  Adiado por ser de menor valor; entidades fixas cobrem o uso atual.
- **Alerta de assinatura `pendente` com vencimento passado**: a regra cobre `ativo` e `vencido`.
  Avaliar se pendencia de ativacao deve virar alerta.
- **Privacidade (LGPD)**: mascarar CPF na tela, registrar base legal do contato pessoa fisica,
  e definir retencao/expurgo do `audit_log` por entidade. Spec de privacidade antes de operar lead frio.

## Pendente do dono (precisa de credencial/acesso)

- ~~**Seed do admin no Railway**~~: FEITO em 2026-06-28. Admin `vitor@waveops.com.br` + 4 planos
  no banco de producao (rodado da maquina do dono via `DIRECT_URL` = `DATABASE_PUBLIC_URL`).
- **Repoint do Prospect**: apontar o adapter do Prospect para `POST /api/ingest/lead` deste CRM
  (troca de URL/token). Nao alterado aqui por estar em edicao no outro repo.

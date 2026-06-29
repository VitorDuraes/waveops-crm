# Spec: Privacidade e LGPD (WaveOps CRM)

Status geral: PARCIAL. Pre-requisito antes de operar lead frio em escala.
Data: 2026-06-28. Stack: Next.js 16 + Drizzle + PostgreSQL (Railway).

O CRM trata dado de empresa, de contato e de lead frio prospectado. Isso e PII real sob a LGPD.
Esta spec inventaria o dado, define base legal, direitos do titular, retencao e os itens a implementar.

## 1. Inventario de PII (o que guardamos)

| Entidade | Campos com PII | Origem |
|---|---|---|
| Empresa | nome, telefone normalizado, documento (CNPJ/CPF), website, origem do lead | manual + ingestao do Prospect |
| Pessoa | nome, e-mail, telefone | manual + ingestao |
| Oportunidade | nome (pode citar pessoa), valor | manual + ingestao |
| audit_log | snapshot `antes`/`depois` em JSONB: pode conter qualquer PII das entidades acima | automatico |
| users | nome, e-mail, hash de senha (bcrypt) | seed/admin |

Dado financeiro do cliente (assinatura, fatura) e dado de negocio, nao PII sensivel, mas confidencial.

## 2. Base legal (LGPD art. 7 e art. 10)

- DEFINIDO: prospeccao B2B (empresa e contato profissional) se apoia em **legitimo interesse**
  (art. 7, IX), com teste de proporcionalidade e opt-out sempre disponivel.
- DEFINIDO: cliente ativo (assinatura) se apoia em **execucao de contrato** (art. 7, V).
- INDEFINIDO: contato pessoa fisica (CPF, autonomo) exige registro da base legal por titular.
  Hoje nao ha campo para isso. Ver item 6.
- FORA DE ESCOPO: dado sensivel (art. 5, II). O CRM nao deve coletar saude, religiao, etc.

## 3. Direitos do titular (art. 18)

- DEFINIDO (processo): acesso, correcao, eliminacao, oposicao e portabilidade atendidos por
  solicitacao ao controlador (WaveOps), com resposta e registro no audit_log.
- INDEFINIDO (tecnico): falta caminho de **eliminacao** e **nao-contatar (opt-out)** na aplicacao.
  Ver itens 6.1 e 6.2.

## 4. Minimizacao e seguranca (ja aplicado)

- Segredo server-only: `DATABASE_URL`, `SESSION_SECRET`, `CRM_INGEST_TOKEN` nunca vao ao cliente.
- Autorizacao barrada na DAL (requireUser/requireAdmin), nao so na rota.
- Senha com bcrypt (12 rounds). Token de ingestao comparado em tempo constante.
- Query parametrizada (Drizzle). Sem concatenacao de input.
- Bancos separados dev e prod.
- DEFINIDO: nao logar PII crua em log de aplicacao sem necessidade (a regra de copy ja evita).

## 5. Retencao

- INDEFINIDO: o `audit_log` e append-only e hoje **sem expurgo**. Proposta: reter 24 meses e
  expurgar/anonimizar registros mais antigos por job idempotente. Decisao do dono.
- INDEFINIDO: lead frio nao convertido. Proposta: revisar e expurgar leads sem interacao apos
  período definido (ex.: 12 meses), respeitando o opt-out.

## 6. A implementar (itens DEFINIDOS de trabalho)

### 6.1 Nao-contatar (opt-out) [DEFINIDO]
Campo booleano `naoContatar` em Empresa e Pessoa (default false). Quando true:
- a entidade some das filas de prospeccao e disparo;
- a ingestao do Prospect NAO reativa o contato (respeita o flag existente);
- a tela mostra o estado e a data/origem do opt-out.

### 6.2 Eliminacao do titular [DEFINIDO]
Acao de admin para **eliminar** ou **anonimizar** uma Empresa/Pessoa a pedido do titular:
- anonimizar (preferido): substitui PII por marcador, preserva metricas agregadas e o vinculo financeiro;
- eliminar (quando exigido): remove o registro e registra a operacao no audit_log (sem a PII).

### 6.3 Mascaramento de documento (CPF) na tela [DEFINIDO]
CPF exibido mascarado por padrao (`***.456.789-**`), com revelar sob acao explicita e auditada.
CNPJ pode ficar visivel (dado publico de empresa).

### 6.4 Base legal por contato pessoa fisica [INDEFINIDO]
Avaliar campo de base legal em Pessoa quando o contato for CPF/autonomo. Decisao juridica do dono.

### 6.5 Retencao do audit_log [INDEFINIDO]
Definir prazo (proposta 24 meses) e job de expurgo/anonimizacao idempotente.

## 7. Ingestao do Prospect (lead frio)

- O endpoint `POST /api/ingest/lead` recebe lead prospectado. Autenticado por Bearer token.
- DEFINIDO: a ingestao deve respeitar `naoContatar` (item 6.1) quando ele existir: lead com opt-out
  conhecido NAO entra ou e marcado, nunca reabre contato.
- DEFINIDO: preview antes de gravar em operacao em massa (import/disparo) ja e regra do projeto.

## 8. Resumo de status

| Item | Status |
|---|---|
| Base legal B2B (legitimo interesse) + contrato | DEFINIDO |
| Seguranca de segredo, DAL, bcrypt, token | DEFINIDO (aplicado) |
| Opt-out (naoContatar) em Empresa/Pessoa | DEFINIDO (a implementar) |
| Eliminacao/anonimizacao do titular | DEFINIDO (a implementar) |
| Mascaramento de CPF na tela | DEFINIDO (a implementar) |
| Base legal por contato PF | INDEFINIDO (decisao juridica) |
| Retencao/expurgo do audit_log e de lead frio | INDEFINIDO (decisao do dono) |
| Coleta de dado sensivel | FORA DE ESCOPO |

Proximo passo recomendado: implementar 6.1 (opt-out) e 6.3 (mascarar CPF) juntos, pois ambos
tocam as telas de Empresa/Pessoa e a ingestao. 6.2 (eliminacao) em seguida.

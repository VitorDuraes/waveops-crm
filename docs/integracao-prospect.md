# Repoint do WaveOps Prospect para o CRM proprio

Guia para apontar o Prospect (coleta de leads) do **Twenty** para o **WaveOps CRM** proprio.
Lado do CRM: pronto. Lado do Prospect: aplicar quando a arvore de trabalho estiver limpa.

## Contexto: o repo do Prospect esta em edicao

Em 2026-06-28 o repo `WaveOps-Prospect` esta na branch `feat/twenty-crm` com ~13 arquivos
modificados sem commit (entre eles `server/leads.ts` e `server/actions/leads.actions.ts`, que sao os
call sites do sync) e uma spec nova de refatoracao. Por isso o repoint NAO foi aplicado automaticamente:
aplicar por cima do WIP embaralharia o que e seu com o que e meu. Faca commit/stash do seu trabalho,
ou crie uma branch limpa, e entao aplique este guia (sao 2 arquivos no Prospect + 2 vars na Vercel).

## Contrato do endpoint (lado do CRM, pronto)

`POST {CRM_API_URL}/api/ingest/lead`
Header: `Authorization: Bearer {CRM_API_TOKEN}` (igual ao `CRM_INGEST_TOKEN` do CRM no Railway).
Body JSON (so `companyName` e obrigatorio):

```json
{
  "companyName": "Studio Bella",
  "contactName": "Maria Silva",
  "phone": "5511987654321",
  "segment": "clinica_saude",
  "document": null,
  "website": null,
  "origem": null,
  "opportunityName": null,
  "planoPretendido": null,
  "valorMensalEstimadoCents": null
}
```

Resposta 200: `{ empresaId, oportunidadeId, pessoaId, dedupedEmpresa, dedupedOportunidade }`.
O CRM ja faz dedupe por documento/telefone e cria Empresa + Pessoa + Oportunidade numa unica chamada.

## Decisao de produto: estagio de entrada

O endpoint cria a oportunidade no **estagio inicial do funil (`novo_lead`)**, sempre. O adapter antigo
do Twenty mapeava o status do lead (`chamado`, `respondeu`, ...) para a etapa correspondente.

Escolha uma:
- **A (recomendada, mais simples):** todo lead prospectado entra em `novo_lead` e o time do CRM
  trabalha o funil a partir dai. O Prospect so empurra o lead, nao espelha o ciclo.
- **B (espelhar status):** manter o mapa status -> estagio. Para isso eu adiciono um campo opcional
  `stage` ao `/api/ingest/lead` (validado contra os estagios do CRM) e o adapter passa
  `mapStatusToStage(lead.status)`. Me avise se quiser a opcao B, e eu faco a mudanca no CRM.

## Passo 1: novo adapter no Prospect

Crie `src/server/integrations/crm.ts` (substitui o uso de `twenty.ts`):

```ts
// src/server/integrations/crm.ts — adapter do WaveOps CRM proprio (substitui twenty.ts).
// Envia o lead contatado para POST /api/ingest/lead numa unica chamada (Empresa+Pessoa+Oportunidade+dedupe).
// Best-effort e idempotente: falha NAO bloqueia o prospect; loga activity.
import "server-only";
import { eq } from "drizzle-orm";
import { leads } from "@/db/schema";
import { isContactedStatus, type CrmLead } from "@/lib/crm";
import { createActivity } from "../activities";
import type { Actor, Database } from "../types";

export type CrmSyncResult =
  | { ok: true; empresaId: string; skipped?: boolean }
  | { ok: false; reason: "not_configured" | "not_contacted" | "http_error" | "unexpected"; detail?: string };

function crmConfig(): { url: string; token: string } | null {
  const url = (process.env.CRM_API_URL ?? "").trim().replace(/\/$/, "");
  const token = (process.env.CRM_API_TOKEN ?? "").trim();
  return url && token ? { url, token } : null;
}

export function isCrmConfigured(): boolean {
  return crmConfig() !== null;
}

export async function syncLeadToCrm(db: Database, lead: CrmLead, actor?: Actor): Promise<CrmSyncResult> {
  const cfg = crmConfig();
  if (!cfg) return { ok: false, reason: "not_configured" };
  if (!isContactedStatus(lead.status)) return { ok: false, reason: "not_contacted" };
  // Idempotencia: reaproveita a coluna que guardava o id do CRM (antes twentyCompanyId).
  if (lead.twentyCompanyId) return { ok: true, empresaId: lead.twentyCompanyId, skipped: true };

  try {
    const res = await fetch(`${cfg.url}/api/ingest/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({
        companyName: lead.companyName.trim(),
        contactName: lead.contactName?.trim() || null,
        phone: lead.phone?.trim() || null,
        segment: lead.segment?.trim() || null,
        // O CRM tambem aceita document, website, origem, opportunityName, planoPretendido,
        // valorMensalEstimadoCents. O CrmLead atual nao carrega esses campos; adicione quando houver.
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CRM HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as { empresaId?: string };
    const empresaId = data.empresaId;
    if (!empresaId) throw new Error("resposta da ingestao sem empresaId");

    await db.transaction(async (tx) => {
      await tx
        .update(leads)
        .set({ twentyCompanyId: empresaId, crmSyncedAt: new Date() })
        .where(eq(leads.id, lead.id));
      await createActivity(tx, {
        leadId: lead.id,
        userId: actor?.id ?? null,
        type: "crm_synced",
        description: "Lead enviado ao CRM (WaveOps)",
        metadata: { empresaId },
      });
    });
    return { ok: true, empresaId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    try {
      await createActivity(db, {
        leadId: lead.id,
        userId: actor?.id ?? null,
        type: "crm_sync_failed",
        description: "Falha ao enviar o lead ao CRM (WaveOps)",
        metadata: { error: detail.slice(0, 300) },
      });
    } catch {
      // nao mascarar o erro original se ate o log falhar
    }
    return { ok: false, reason: "http_error", detail };
  }
}
```

Nota de idempotencia: o adapter reusa a coluna `twentyCompanyId` para guardar o `empresaId` do CRM
(evita migration agora). O ideal e renomear para `crmEmpresaId` numa migration quando estabilizar.

## Passo 2: trocar o call site

Onde hoje se chama `syncLeadToTwenty(...)` (em `src/server/leads.ts` e/ou
`src/server/actions/leads.actions.ts`), trocar por `syncLeadToCrm(...)`. A assinatura e a forma de
retorno sao equivalentes (`ok`/`reason`). Rodar os testes do Prospect (`npm test`) e o `lint`/`build`.

## Passo 3: variaveis na Vercel (Production do Prospect)

Remover (ou deixar de usar) `TWENTY_API_URL` e `TWENTY_API_TOKEN`. Adicionar:

- `CRM_API_URL` = a URL publica do CRM no Railway (ex.: `https://waveops-crm-production.up.railway.app`).
- `CRM_API_TOKEN` = o mesmo valor do `CRM_INGEST_TOKEN` configurado no servico do CRM no Railway.

Atualizar tambem `poc/deploy/vercel/prospect.env.example` (no repo do backbone) para refletir os novos nomes.

## Passo 4: validar a ponta a ponta

Teste o endpoint do CRM direto (substitua URL e token):

```bash
curl -sS -X POST "https://<crm>.up.railway.app/api/ingest/lead" \
  -H "Authorization: Bearer <CRM_INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Teste Ingestao","contactName":"Fulano","phone":"5511999999999"}'
```

Esperado: `200` com `empresaId`. Depois, abra o Funil do CRM e confirme a empresa/oportunidade em
`Novo Lead`. Por fim, marque um lead como contatado no Prospect e confirme que ele aparece no CRM.

## Resumo do que falta (e de quem depende)

- Lado CRM: pronto (endpoint, dedupe, este guia). Se quiser a opcao B (espelhar estagio), me avise.
- Lado Prospect (seu): aplicar passos 1 e 2 sobre uma arvore limpa, e setar as 2 vars na Vercel (passo 3).
- Valores que so voce tem: a URL publica do CRM no Railway e o `CRM_INGEST_TOKEN`. Me mande os dois e
  eu deixo o `prospect.env.example` e qualquer doc do backbone consistentes.

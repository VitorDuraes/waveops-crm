# Deploy do WaveOps CRM no Railway

App Next.js 16 + Drizzle + Postgres. O Railway builda com Railpack (zero config) e roda as migrations sozinho no deploy. Tudo numa plataforma so.

## Pre-requisitos

- Repo no GitHub (ex.: `VitorDuraes/waveops-crm`). Railway deploya de um repo Git.
- Conta Railway (plano Hobby ja pago).

## Passos

1. **Push do repo** para o GitHub.
2. **Novo projeto no Railway** > Deploy from GitHub repo > selecione o repo do CRM.
3. **Adicione o Postgres**: no projeto, New > Database > PostgreSQL.
4. **Variaveis** no servico do app (Settings > Variables):
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference; conexao direta, rede privada).
   - `SESSION_SECRET` = gere novo (`openssl rand -base64 48`).
   - `CRM_INGEST_TOKEN` = gere novo (`openssl rand -base64 32`). E o token que o Prospect usa.
   - `HOSTNAME` = `0.0.0.0`.
   - (PORT e injetada pelo Railway; o Next escuta nela sozinho.)
5. **Deploy**. O `railway.json` ja cuida de:
   - build via Railpack;
   - `preDeployCommand: node scripts/migrate.mjs` (aplica as migrations uma vez por deploy);
   - healthcheck em `/api/health`;
   - restart on-failure.
6. **Dominio**: Settings > Networking > Generate Domain (sai um `*.up.railway.app` com HTTPS), ou aponte um dominio custom (CNAME).

## Validar

- `https://<seu-app>.up.railway.app/api/health` -> `{"ok":true}`.
- Abrir a URL, logar (rode o seed uma vez para criar o admin: localmente `npm run db:seed`, ou via `railway run npm run db:seed`).
- Ver o Funil e cadastrar empresa/oportunidade.

## Ingestao (Prospect -> CRM)

O Prospect manda lead para `POST https://<seu-app>.up.railway.app/api/ingest/lead` com header `Authorization: Bearer <CRM_INGEST_TOKEN>`. No Prospect, setar `CRM_API_URL` (a URL publica do CRM) e `CRM_API_TOKEN` (= CRM_INGEST_TOKEN).

## Notas

- Postgres do Railway e conexao direta: sem pooler, sem `prepare:false`. Se um dia ligar PgBouncer, separar a URL de migration (unpooled).
- Regiao: Railway nao tem Brasil; US East (Virginia) e a de menor latencia. Dado fora do pais (avaliar LGPD).
- Custo: Hobby inclui US$ 5 de uso. App + Postgres do CRM cabem perto disso; cada servico extra (Portal, Prospect, mais bancos) consome a mais.

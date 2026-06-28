// src/db/seed.ts — seed idempotente para DEV. Rode com: npm run db:seed
// Requer o banco no ar (docker compose -f docker-compose.dev.yml up -d) e migrado (db:migrate).
// Usa conexao propria (NAO importa src/db/client.ts, que e server-only e quebraria fora do Next).
//
// MVP da fundacao: cria apenas o admin inicial. Dados de funil (empresas, pessoas,
// oportunidades) entram com as telas, nas proximas fases.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashPassword } from "../lib/auth/password";
import * as schema from "./schema";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: usa o ambiente atual
}

async function main() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DIRECT_URL/DATABASE_URL nao definida. Configure o ambiente antes do seed.");
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@waveops.local").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  if (process.env.NODE_ENV === "production" && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error("Em producao defina SEED_ADMIN_PASSWORD forte antes de rodar o seed.");
  }

  const sqlClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    const passwordHash = await hashPassword(password);
    // Idempotente: nao sobrescreve um admin ja existente (nao reescreve a senha).
    await db
      .insert(schema.users)
      .values({ name: "Admin", email, passwordHash, role: "admin", active: true })
      .onConflictDoNothing({ target: schema.users.email });
    console.log(`Seed concluido. Admin garantido: ${email}`);

    // Planos WaveOps (idempotente: so insere se a tabela estiver vazia).
    const planosExistentes = await db.select({ id: schema.planos.id }).from(schema.planos).limit(1);
    if (planosExistentes.length === 0) {
      await db.insert(schema.planos).values([
        { name: "Operacao", descricao: "Automacao essencial para comecar.", precoMensalCents: 39700, ciclo: "mensal", nivelDeSuporte: "E-mail", ativo: true },
        { name: "Essencial", descricao: "Operacao com integracoes e dashboards.", precoMensalCents: 49700, ciclo: "mensal", nivelDeSuporte: "E-mail e WhatsApp", ativo: true },
        { name: "Pro", descricao: "Automacao avancada e agentes supervisionados.", precoMensalCents: 99700, ciclo: "mensal", nivelDeSuporte: "Prioritario", ativo: true },
        { name: "Empresarial", descricao: "Operacao sob medida com SLA dedicado.", precoMensalCents: 199700, ciclo: "mensal", nivelDeSuporte: "Dedicado", ativo: true },
      ]);
      console.log("Seed: 4 planos criados.");
    }
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

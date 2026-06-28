// drizzle.config.ts — configuracao do drizzle-kit.
// Usada por: db:generate (gera migration a partir do schema),
// db:migrate (aplica migrations versionadas) e db:studio.
import { defineConfig } from "drizzle-kit";

// Carrega .env.local sem dependencia externa (Node >= 20.12). Se ausente, usa o ambiente.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local nao encontrado: segue com process.env atual.
}

// Migrations usam a conexao DIRETA. Em prod (Supabase) DATABASE_URL e o pooler
// (porta 6543, transaction mode), que nao serve para migrar: defina DIRECT_URL
// com a conexao direta (porta 5432). Local: cai em DATABASE_URL.
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DIRECT_URL/DATABASE_URL nao definida. Exporte a variavel antes de rodar drizzle-kit.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  // Schema do Drizzle (tabelas do CRM: users, empresas, pessoas, oportunidades).
  schema: "./src/db/schema.ts",
  // Migrations versionadas e commitadas no repo. Aplicadas em ordem por db:migrate.
  out: "./src/db/migrations",
  dbCredentials: { url: databaseUrl },
  // Falha cedo se schema e banco divergirem fora de uma migration.
  strict: true,
  verbose: true,
});

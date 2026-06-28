// src/db/verify-admin.ts — verificacao READ-ONLY do admin no banco apontado por DIRECT_URL/DATABASE_URL.
// Nao grava nada. Lista os usuarios e testa a senha informada. Rode com: npm.cmd run db:verify
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { verifyPassword } from "../lib/auth/password";
import * as schema from "./schema";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: usa o ambiente atual
}

async function main() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DIRECT_URL/DATABASE_URL nao definida.");
  }
  const host = (() => {
    try {
      return new URL(databaseUrl).host;
    } catch {
      return "(url ilegivel)";
    }
  })();
  console.log(`Conectando em: ${host}`);

  const email = (process.env.SEED_ADMIN_EMAIL ?? "vitor@waveops.com.br").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Vi246879@";

  const sqlClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sqlClient, { schema });
  try {
    const rows = await db.select().from(schema.users);
    console.log(`Total de usuarios no banco: ${rows.length}`);
    for (const u of rows) {
      console.log(`  - ${u.email} | role: ${u.role} | active: ${u.active}`);
    }
    const target = rows.find((u) => u.email === email);
    if (!target) {
      console.log(`NAO encontrei o usuario ${email} neste banco.`);
    } else {
      const ok = await verifyPassword(password, target.passwordHash);
      console.log(`Usuario ${email} existe. Senha confere: ${ok ? "SIM" : "NAO"}`);
    }
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

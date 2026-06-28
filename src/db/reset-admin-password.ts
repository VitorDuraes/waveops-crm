// src/db/reset-admin-password.ts — reseta a senha de UM usuario existente (por e-mail).
// Diferente do seed: este SOBRESCREVE a senha. Use quando o admin ja existe com senha errada.
// Exige SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD explicitos. Rode com: npm.cmd run db:reset-pw
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
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
    throw new Error("DIRECT_URL/DATABASE_URL nao definida.");
  }
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD antes de rodar.");
  }

  const sqlClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sqlClient, { schema });
  try {
    const passwordHash = await hashPassword(password);
    const updated = await db
      .update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.email, email))
      .returning({ id: schema.users.id, email: schema.users.email });

    if (updated.length === 0) {
      console.log(`Nenhum usuario com e-mail ${email}. Nada alterado.`);
    } else {
      console.log(`Senha redefinida para: ${updated[0].email}`);
    }
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

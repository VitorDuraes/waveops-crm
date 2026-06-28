// Aplica as migrations Drizzle usando SO dependencias de runtime (drizzle-orm +
// postgres), sem drizzle-kit nem tsx. Pensado para o pre-deploy command do Railway
// (roda uma vez por deploy, antes do app subir), onde devDependencies podem nao
// existir na imagem. Idempotente: aplica so o que falta.
//   Railway: deploy.preDeployCommand = ["node scripts/migrate.mjs"]
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL nao definida.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./src/db/migrations" });
  console.log("[migrate] migrations aplicadas.");
} catch (e) {
  console.error("[migrate] falhou:", e?.message || e);
  process.exit(1);
} finally {
  await sql.end();
}

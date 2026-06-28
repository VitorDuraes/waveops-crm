// src/db/client.ts — conexao unica com o Postgres via postgres-js + Drizzle.
// server-only: nunca pode ser importado por Client Component.
// Inicializacao PREGUICOSA: importar este modulo NAO exige DATABASE_URL. A conexao so e
// criada (e a env validada) no primeiro uso real de `db`/`sql`. Isso mantem o `next build`
// seguro sem banco (paginas force-dynamic so consultam em runtime), sem furar o server-only.
import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

type Schema = typeof schema;

// Singleton por processo (e por modulo no hot reload do dev): evita esgotar o pool.
const globalForDb = globalThis as unknown as {
  __waveopsCrmSql?: Sql;
  __waveopsCrmDb?: PostgresJsDatabase<Schema>;
};

function init(): { sqlClient: Sql; dbClient: PostgresJsDatabase<Schema> } {
  if (globalForDb.__waveopsCrmSql && globalForDb.__waveopsCrmDb) {
    return { sqlClient: globalForDb.__waveopsCrmSql, dbClient: globalForDb.__waveopsCrmDb };
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao definida. Configure o ambiente (server-only).");
  }
  // Pooler (PgBouncer em transaction mode, ex: Neon/Supabase pooled, usado em serverless)
  // nao suporta prepared statements. Detecta pela URL e desliga o prepare nesse caso.
  // Conexao direta (dev em Docker, ou host Neon sem "-pooler") mantem prepared statements.
  const isPooled = /\.pooler\.|-pooler\.|[?&]pgbouncer=true/.test(databaseUrl);
  const sqlClient = postgres(databaseUrl, { max: 10, prepare: !isPooled });
  const dbClient = drizzle(sqlClient, { schema });
  globalForDb.__waveopsCrmSql = sqlClient;
  globalForDb.__waveopsCrmDb = dbClient;
  return { sqlClient, dbClient };
}

// Proxy preguicoso: acessar um metodo (db.select, db.transaction, ...) inicializa sob demanda.
export const db = new Proxy({} as PostgresJsDatabase<Schema>, {
  get(_target, prop, receiver) {
    const real = init().dbClient as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

// `sql` e uma tagged template (chamavel) com metodos: precisa de apply + get.
export const sql = new Proxy(function () {} as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    const real = init().sqlClient as unknown as (...a: unknown[]) => unknown;
    return real(...args);
  },
  get(_target, prop, receiver) {
    const real = init().sqlClient as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

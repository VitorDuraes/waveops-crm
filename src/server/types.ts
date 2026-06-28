// src/server/types.ts — tipos compartilhados da camada de dominio (server).
// Os repositorios recebem `db` por injecao (DbOrTx) para serem testaveis sem o client server-only.
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase, PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { Role } from "@/lib/validators";
import type * as schema from "@/db/schema";

export type Schema = typeof schema;
export type Database = PostgresJsDatabase<Schema>;
export type Transaction = PgTransaction<
  PostgresJsQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;
export type DbOrTx = Database | Transaction;

// Quem executa a operacao (usado para autorizacao no dominio).
export type Actor = { id: string; role: Role };

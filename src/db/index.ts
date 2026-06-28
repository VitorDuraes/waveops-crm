// src/db/index.ts — barrel server-only. Use `@/db` para `db` e tabelas.
// Para apenas tipos de tabela em codigo client-safe, importe de `@/db/schema`.
export { db, sql } from "./client";
export * from "./schema";

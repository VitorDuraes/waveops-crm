// src/lib/auth/types.ts — tipos de auth client-safe.
// Separado de actions.ts porque arquivos "use server" so podem exportar funcoes async.
export type LoginState = { error?: string } | undefined;

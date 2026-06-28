// src/lib/auth/index.ts — barrel publico de auth (SERVER-ONLY: nao importar em Client Component).
// Client Components devem importar a action de "@/server/actions/auth.actions" e o tipo de "@/lib/auth/types".
// verifySession NAO e re-exportado de proposito: ele le so o cookie (role congelada no JWT, sem
// revalidar no banco). Toda autorizacao deve usar getCurrentUser/requireUser/requireAdmin, que
// releem users.active e users.role. Quem precisar do primitivo otimista importa de "./dal" direto.
export { getCurrentUser, requireAdmin, requireUser } from "./dal";
export type { CurrentUser } from "./dal";
export { login, logout } from "./actions";
export type { LoginState } from "./types";
export type { SessionPayload } from "./jwt";

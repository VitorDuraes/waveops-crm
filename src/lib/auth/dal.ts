// src/lib/auth/dal.ts — Data Access Layer de auth (server-only). Barreira PRIMARIA de autorizacao.
// O proxy e otimista (so cookie); aqui revalidamos o usuario no banco a cada render.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { ROLES, type Role } from "@/lib/validators";
import { ROOT_REDIRECT } from "./constants";
import { getSession } from "./session";
import type { SessionPayload } from "./jwt";

export type CurrentUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
};

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

// Sessao crua do cookie (role CONGELADA no JWT). Redireciona se ausente. Memoizada por render.
// AVISO: primitivo OTIMISTA, NAO revalida no banco. Nunca use para autorizacao (role/active);
// use getCurrentUser/requireUser/requireAdmin. Por isso nao e exportado no barrel publico.
export const verifySession = cache(async (): Promise<SessionPayload> => {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
});

// Usuario fresco do banco (sem password_hash). Revalida existencia + active. Memoizado por render.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;

  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      name: users.name,
      email: users.email,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const user = rows[0];
  if (!user || !user.active) return null;
  if (!isRole(user.role)) return null;

  return { id: user.id, role: user.role, name: user.name, email: user.email };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect(ROOT_REDIRECT);
  return user;
}

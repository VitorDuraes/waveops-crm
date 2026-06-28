"use server";
// src/lib/auth/actions.ts — Server Actions de login/logout.
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { ROLES, type Role } from "@/lib/validators";
import { ROOT_REDIRECT } from "./constants";
import { TIMING_DUMMY_HASH, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import type { LoginState } from "./types";

// Mensagem unica e generica (anti-enumeracao): nao revela se foi e-mail ou senha.
const INVALID_CREDENTIALS = "E-mail ou senha inválidos.";

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Valida formato antes de tocar o banco.
  if (!email || !email.includes("@") || !password) {
    return { error: INVALID_CREDENTIALS };
  }

  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      passwordHash: users.passwordHash,
      active: users.active,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];

  // Usuario inexistente/inativo: faz um compare dummy para equalizar o tempo (anti-enumeracao)
  // e devolve a MESMA mensagem generica.
  if (!user || !user.active || !isRole(user.role)) {
    await verifyPassword(password, TIMING_DUMMY_HASH);
    return { error: INVALID_CREDENTIALS };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return { error: INVALID_CREDENTIALS };
  }

  await createSession({ id: user.id, role: user.role });
  redirect(ROOT_REDIRECT);
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

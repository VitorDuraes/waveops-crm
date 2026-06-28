// src/lib/auth/session.ts — leitura/escrita do cookie de sessao (server-only).
// Usa next/headers cookies() (NAO pode ser importado pelo proxy; o proxy usa jwt.ts direto).
import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@/lib/validators";
import { cookieOptions, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./constants";
import { decryptSession, encryptSession, type SessionPayload } from "./jwt";

export type { SessionPayload };

export async function createSession(user: { id: string; role: Role }): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const token = await encryptSession({
    userId: user.id,
    role: user.role,
    expiresAt: expiresAt.toISOString(),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt));
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return decryptSession(token);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

// src/lib/auth/jwt.ts — assina/verifica o JWT de sessao (HS256 via jose).
// PURO: sem next/headers, sem server-only. Pode ser importado pelo proxy (runtime de borda/node).
import { jwtVerify, SignJWT } from "jose";
import { ROLES, type Role } from "@/lib/validators";
import { SESSION_MAX_AGE_SECONDS } from "./constants";

export type SessionPayload = {
  userId: string;
  role: Role;
  expiresAt: string; // ISO
};

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function getKey(): Uint8Array {
  // HS256 depende inteiramente da entropia do segredo: exige presenca E tamanho minimo.
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou fraca (>= 32 bytes). Gere com: openssl rand -base64 48",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, role: payload.role, expiresAt: payload.expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getKey());
}

export async function decryptSession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  const key = getKey(); // fail-fast se SESSION_SECRET ausente
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (
      typeof payload.userId === "string" &&
      isRole(payload.role) &&
      typeof payload.expiresAt === "string"
    ) {
      return { userId: payload.userId, role: payload.role, expiresAt: payload.expiresAt };
    }
    return null;
  } catch {
    // assinatura ou expiracao invalida -> sem sessao
    return null;
  }
}

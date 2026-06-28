// src/lib/auth/password.ts — hash e verificacao de senha com bcryptjs (puro, testavel).
import bcrypt from "bcryptjs";

export const BCRYPT_ROUNDS = 12;

// Hash valido de uma senha aleatoria. Usado SO para equalizar o tempo de login quando o
// e-mail nao existe (evita enumeracao de usuarios por timing). Nunca e uma senha real.
export const TIMING_DUMMY_HASH =
  "$2b$12$CSq/h3UErtxgYyWgJEsAd./iaIMZUx1VRhBKUR9Yxac9jVtGfNE0e";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    // hash malformado nao deve derrubar o login; trata como falha de credencial.
    return false;
  }
}

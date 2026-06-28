// src/lib/auth/constants.ts — constantes centrais de auth (proxy e DAL compartilham).
export const SESSION_COOKIE_NAME = "waveops_crm_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

// Rotas acessiveis sem sessao. (acrescentar "/privacidade" quando existir, LGPD)
export const PUBLIC_ROUTES = ["/login"] as const;

// Destino do usuario autenticado (raiz da operacao): o Kanban do funil.
export const ROOT_REDIRECT = "/funil";

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  expires: Date;
};

// secure so em producao para nao quebrar http://localhost no dev.
export function cookieOptions(expiresAt: Date): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  };
}

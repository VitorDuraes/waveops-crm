// src/proxy.ts — protecao OTIMISTA de rota (ex-middleware no Next 16).
// So le o cookie e decide redirect. NAO e barreira de autorizacao: a barreira real
// e a DAL (requireUser/requireAdmin), que revalida no banco a cada render.
import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_ROUTES, ROOT_REDIRECT, SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { decryptSession } from "@/lib/auth/jwt";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSession(token);

  // Sem sessao numa rota privada -> login.
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // Com sessao na pagina de login -> manda para a raiz da operacao (funil).
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL(ROOT_REDIRECT, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

// src/app/page.tsx — raiz. Logado -> /funil. Sem sessao -> /login.
// getCurrentUser revalida a sessao no banco (DAL). O proxy ja cobre o caminho otimista.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/funil" : "/login");
}

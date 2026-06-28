// src/lib/nav.ts — itens de navegacao do shell protegido. Puro (client-safe).
// MVP do funil: Funil (Kanban) e Empresas. Novas telas entram aqui.
import type { Role } from "@/lib/validators";

export type NavItem = {
  key: string;
  href: string;
  label: string;
  // Quando definido, so estes papeis veem o item. Ausente = todos os papeis.
  roles?: readonly Role[];
};

export const NAV: readonly NavItem[] = [
  { key: "dashboards", href: "/dashboards", label: "Dashboards" },
  { key: "funil", href: "/funil", label: "Funil" },
  { key: "propostas", href: "/propostas", label: "Propostas" },
  { key: "empresas", href: "/empresas", label: "Empresas" },
  { key: "cobranca", href: "/cobranca", label: "Cobrança" },
  { key: "buscar", href: "/buscar", label: "Buscar" },
];

export function navForRole(role: Role): NavItem[] {
  return NAV.filter((item) => !item.roles || item.roles.includes(role));
}

// Item ativo: casa o path exato ou um prefixo (mais especifico primeiro).
export function activeNavItem(pathname: string): NavItem | undefined {
  return [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
}

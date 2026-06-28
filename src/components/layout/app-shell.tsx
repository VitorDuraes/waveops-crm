"use client";
// src/components/layout/app-shell.tsx — shell das telas internas: sidebar + topo + logout.
// Mostra o papel do usuario. Navegacao por papel (navForRole). Tailwind puro, sem libs.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE_LABELS } from "@/lib/crm/labels";
import { activeNavItem, navForRole } from "@/lib/nav";
import type { Role } from "@/lib/validators";
import { logout } from "@/server/actions/auth.actions";

type ShellUser = { name: string; role: Role };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = activeNavItem(pathname);
  const title = active?.label ?? "WaveOps CRM";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 flex-none flex-col border-r border-neutral-200 bg-white">
        <div className="flex h-16 flex-none items-center gap-2.5 border-b border-neutral-200 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-brand to-indigo-600 text-sm font-bold text-white shadow-sm shadow-violet-200">
            W
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-neutral-900">
            WaveOps CRM
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navForRole(user.role).map((item) => {
            const on = active?.key === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`rounded-xl px-3 py-2.5 text-sm transition-all ${
                  on
                    ? "bg-linear-to-r from-brand to-indigo-600 font-semibold text-white shadow-md shadow-violet-500/20"
                    : "font-medium text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Usuario + papel + logout */}
        <div className="flex-none border-t border-neutral-200 p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-linear-to-br from-brand to-indigo-600 text-xs font-semibold text-white shadow-sm shadow-violet-200">
              {initialsOf(user.name)}
            </span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-neutral-900">{user.name}</span>
              <span className="text-[11px] text-neutral-500">{ROLE_LABELS[user.role]}</span>
            </div>
            <form action={logout} className="ml-auto flex-none">
              <button
                type="submit"
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Conteudo */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#f6f6f8]">
        <header className="flex h-16 flex-none items-center border-b border-neutral-200 bg-white/80 px-6">
          <h1 className="font-display text-xl font-semibold tracking-tight text-neutral-900">
            {title}
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

"use client";
// src/app/login/page.tsx — login (email + senha). useActionState + a action portada.
// Em sucesso a action faz redirect(ROOT_REDIRECT). Erro volta em state.error.
import { useActionState } from "react";
import { login } from "@/server/actions/auth.actions";
import type { LoginState } from "@/lib/auth/types";

const initialState: LoginState = undefined;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm"
            style={{ background: "var(--color-brand)" }}
          >
            W
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-neutral-900">
            WaveOps CRM
          </span>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-neutral-900">Entrar</h1>
        <p className="mb-6 text-sm text-neutral-500">Acesse o funil de vendas.</p>

        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            E-mail
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="voce@waveops.com.br"
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            Senha
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className={inputCls}
            />
          </label>

          {state?.error ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-xl bg-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputCls =
  "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-shadow placeholder:text-neutral-400 focus:border-[var(--color-brand)] focus:ring-2 focus:ring-violet-100";

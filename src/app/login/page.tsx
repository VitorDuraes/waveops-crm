"use client";
// src/app/login/page.tsx — login (email + senha). useActionState + a action portada.
// Em sucesso a action faz redirect(ROOT_REDIRECT). Erro volta em state.error.
// Visual: fundo Aurora (ReactBits/WebGL) + card glass. Marca em GradientText, subtitulo em ShinyText.
import { useActionState } from "react";
import { login } from "@/server/actions/auth.actions";
import type { LoginState } from "@/lib/auth/types";
import Aurora from "@/components/ui/reactbits/Aurora";
import GradientText from "@/components/ui/reactbits/GradientText";
import ShinyText from "@/components/ui/reactbits/ShinyText";

const initialState: LoginState = undefined;
const BRAND_STOPS = ["#7c3aed", "#22d3ee", "#7c3aed"];

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070711] px-6 py-16">
      {/* Fundo Aurora (WebGL). Degrada para o fundo escuro se o navegador nao tiver WebGL2. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[72vh] opacity-70">
        <Aurora colorStops={BRAND_STOPS} amplitude={1.1} blend={0.55} speed={0.7} />
      </div>
      {/* Vinheta para fundir a Aurora no fundo. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-10%,transparent_42%,#070711_76%)]" />

      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_-24px_rgba(124,58,237,0.5)] backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand to-brand-2 text-base font-bold text-white shadow-lg shadow-violet-500/30">
            W
          </span>
          <div>
            <GradientText
              colors={BRAND_STOPS}
              animationSpeed={9}
              className="font-display text-lg font-semibold tracking-tight"
            >
              WaveOps CRM
            </GradientText>
          </div>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-white">Entrar</h1>
        <p className="mb-6 text-sm">
          <ShinyText text="Acesse o funil de vendas." speed={4} color="#9ca3af" shineColor="#ffffff" />
        </p>

        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-300">
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

          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-300">
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
              className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-xl bg-linear-to-r from-brand to-brand-2 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:brightness-110 hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-violet-500/30";

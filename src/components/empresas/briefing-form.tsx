"use client";
// src/components/empresas/briefing-form.tsx — briefing da empresa (1 por empresa, upsert).
// Form inline com os valores atuais preenchidos. Salvar chama upsertBriefingAction.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertBriefingAction } from "@/server/actions/briefings.actions";

export type BriefingValues = {
  objetivo: string | null;
  ferramentaAtual: string | null;
  dor: string | null;
  volume: string | null;
};

export function BriefingForm({
  empresaId,
  briefing,
}: {
  empresaId: string;
  briefing: BriefingValues | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await upsertBriefingAction(null, formData);
      if (result?.ok) {
        setMessage(result.message);
        router.refresh();
      } else {
        setError(result?.message ?? "Não foi possível salvar o briefing.");
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <input type="hidden" name="empresaId" value={empresaId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Objetivo">
          <textarea
            name="objetivo"
            rows={2}
            defaultValue={briefing?.objetivo ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Ferramenta atual">
          <textarea
            name="ferramentaAtual"
            rows={2}
            defaultValue={briefing?.ferramentaAtual ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Dor">
          <textarea name="dor" rows={2} defaultValue={briefing?.dor ?? ""} className={inputCls} />
        </Field>
        <Field label="Volume">
          <textarea
            name="volume"
            rows={2}
            defaultValue={briefing?.volume ?? ""}
            className={inputCls}
          />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar briefing"}
        </button>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-violet-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
      {label}
      {children}
    </label>
  );
}

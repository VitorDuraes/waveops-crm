"use client";
// src/components/oportunidades/proposta-quick-create.tsx — proposta rapida ja ligada a esta oportunidade.
// Padrao do oportunidade-create-form: useTransition + useRef + chamada direta da action.
// oportunidadeId vai como hidden. Form compacto (name, plano, valor mensal, validade, link).
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLANO } from "@/lib/validators";
import { PLANO_LABELS } from "@/lib/crm/labels";
import { createPropostaAction } from "@/server/actions/propostas.actions";

export function PropostaQuickCreate({ oportunidadeId }: { oportunidadeId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createPropostaAction(null, formData);
      if (result?.ok) {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result?.message ?? "Não foi possível criar a proposta.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
        }}
        className="w-fit rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {open ? "Cancelar" : "Nova proposta"}
      </button>

      {open ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-4 text-base font-semibold text-neutral-900">Nova proposta</h3>
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input type="hidden" name="oportunidadeId" value={oportunidadeId} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome *">
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Ex: Proposta assinatura Pro"
                  className={inputCls}
                />
              </Field>
              <Field label="Plano">
                <select name="plano" defaultValue="" className={inputCls}>
                  <option value="">Selecione...</option>
                  {PLANO.map((p) => (
                    <option key={p} value={p}>
                      {PLANO_LABELS[p]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor mensal">
                <input name="valorMensal" type="text" placeholder="R$ 997,00" className={inputCls} />
              </Field>
              <Field label="Validade">
                <input name="validade" type="date" className={inputCls} />
              </Field>
              <Field label="Link">
                <input
                  name="link"
                  type="url"
                  placeholder="https://..."
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
                {isPending ? "Salvando..." : "Criar proposta"}
              </button>
              {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            </div>
          </form>
        </section>
      ) : null}
    </div>
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

"use client";
// src/components/propostas/proposta-create-form.tsx — nova proposta.
// Padrao do Prospect: useTransition + chamada direta da action (sem useActionState/efeito).
// Status default 'rascunho' definido no schema. Lista de oportunidades vem do Server Component.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLANO_LABELS } from "@/lib/crm/labels";
import { PLANO } from "@/lib/validators";
import { createPropostaAction } from "@/server/actions/propostas.actions";

export type OportunidadeOption = { id: string; label: string };

export function PropostaCreateForm({ oportunidades }: { oportunidades: OportunidadeOption[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const noOportunidades = oportunidades.length === 0;

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
        disabled={noOportunidades}
        title={noOportunidades ? "Cadastre uma oportunidade antes de criar uma proposta." : undefined}
        className="w-fit rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {open ? "Cancelar" : "Nova proposta"}
      </button>

      {noOportunidades ? (
        <p className="text-xs text-neutral-500">Cadastre uma oportunidade antes de criar uma proposta.</p>
      ) : null}

      {open ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-4 text-base font-semibold text-neutral-900">Nova proposta</h3>
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome *">
                <input name="name" type="text" required placeholder="Ex: Proposta assinatura Pro" className={inputCls} />
              </Field>
              <Field label="Oportunidade *">
                <select name="oportunidadeId" required defaultValue="" className={inputCls}>
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {oportunidades.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
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
                <input name="valorMensal" type="text" placeholder="R$ 1.500,00" className={inputCls} />
              </Field>
              <Field label="Valor de setup">
                <input name="valorSetup" type="text" placeholder="R$ 2.000,00" className={inputCls} />
              </Field>
              <Field label="Validade">
                <input name="validade" type="date" className={inputCls} />
              </Field>
              <Field label="Link">
                <input name="link" type="url" placeholder="https://..." className={inputCls} />
              </Field>
            </div>

            <Field label="Escopo">
              <textarea
                name="escopo"
                rows={4}
                placeholder="Descreva o escopo da proposta."
                className={inputCls}
              />
            </Field>

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

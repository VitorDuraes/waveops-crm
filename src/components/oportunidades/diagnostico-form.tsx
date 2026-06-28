"use client";
// src/components/oportunidades/diagnostico-form.tsx — novo diagnostico (qualificacao do deal).
// Padrao do oportunidade-create-form: useTransition + useRef + chamada direta da action.
// oportunidadeId vai como hidden. Em sucesso: reset do form e router.refresh.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FIT } from "@/lib/validators";
import { FIT_LABELS } from "@/lib/crm/labels";
import { createDiagnosticoAction } from "@/server/actions/diagnosticos.actions";

export function DiagnosticoForm({ oportunidadeId }: { oportunidadeId: string }) {
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
      const result = await createDiagnosticoAction(null, formData);
      if (result?.ok) {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result?.message ?? "Não foi possível salvar o diagnóstico.");
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
        {open ? "Cancelar" : "Novo diagnóstico"}
      </button>

      {open ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-4 text-base font-semibold text-neutral-900">Novo diagnóstico</h3>
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input type="hidden" name="oportunidadeId" value={oportunidadeId} />

            <Field label="Dor">
              <textarea
                name="dor"
                rows={2}
                placeholder="Qual problema o cliente quer resolver?"
                className={inputCls}
              />
            </Field>
            <Field label="Processo atual">
              <textarea
                name="processoAtual"
                rows={2}
                placeholder="Como o time faz isso hoje?"
                className={inputCls}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ferramentas">
                <input
                  name="ferramentas"
                  type="text"
                  placeholder="Ex: planilha, WhatsApp"
                  className={inputCls}
                />
              </Field>
              <Field label="Volume">
                <input
                  name="volume"
                  type="text"
                  placeholder="Ex: 200 leads/mês"
                  className={inputCls}
                />
              </Field>
              <Field label="Fit">
                <select name="fit" defaultValue="" className={inputCls}>
                  <option value="">Selecione...</option>
                  {FIT.map((f) => (
                    <option key={f} value={f}>
                      {FIT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Salvando..." : "Salvar diagnóstico"}
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

"use client";
// src/components/cobranca/fatura-create-form.tsx — nova fatura (cobranca de uma empresa).
// Padrao do Prospect: useTransition + chamada direta da action (sem useActionState/efeito).
// Valor e obrigatorio (em BRL, convertido para centavos na action via parseBRLToCents).
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FORMA_PAGAMENTO_LABELS, STATUS_FATURA_LABELS } from "@/lib/crm/labels";
import { FORMA_PAGAMENTO, STATUS_FATURA } from "@/lib/validators";
import { createFaturaAction } from "@/server/actions/faturas.actions";

export type EmpresaOption = { id: string; name: string };

export function FaturaCreateForm({ empresas }: { empresas: EmpresaOption[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const noEmpresas = empresas.length === 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createFaturaAction(null, formData);
      if (result?.ok) {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result?.message ?? "Não foi possível criar a fatura.");
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
        disabled={noEmpresas}
        title={noEmpresas ? "Cadastre uma empresa antes de criar uma fatura." : undefined}
        className="w-fit rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {open ? "Cancelar" : "Nova fatura"}
      </button>

      {noEmpresas ? (
        <p className="text-xs text-neutral-500">Cadastre uma empresa antes de criar uma fatura.</p>
      ) : null}

      {open ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-4 text-base font-semibold text-neutral-900">Nova fatura</h3>
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Empresa *">
                <select name="empresaId" required defaultValue="" className={inputCls}>
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor *">
                <input name="valor" type="text" required placeholder="R$ 997,00" className={inputCls} />
              </Field>
              <Field label="Vencimento">
                <input name="vencimento" type="date" className={inputCls} />
              </Field>
              <Field label="Forma de pagamento">
                <select name="formaPagamento" defaultValue="" className={inputCls}>
                  <option value="">-</option>
                  {FORMA_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {FORMA_PAGAMENTO_LABELS[f]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select name="status" defaultValue="em_aberto" className={inputCls}>
                  {STATUS_FATURA.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_FATURA_LABELS[s]}
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
                {isPending ? "Salvando..." : "Criar fatura"}
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

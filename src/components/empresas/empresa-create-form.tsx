"use client";
// src/components/empresas/empresa-create-form.tsx — form de nova empresa.
// Padrao do Prospect: useTransition + chamada direta da action (sem useActionState/efeito),
// para fechar o form e dar router.refresh no proprio handler. A action valida sessao e input.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ORIGEM_LABELS,
  SEGMENTO_LABELS,
  STATUS_CLIENTE_LABELS,
} from "@/lib/crm/labels";
import { ORIGEM, SEGMENTO, STATUS_CLIENTE } from "@/lib/validators";
import { createEmpresaAction } from "@/server/actions/empresas.actions";

export function EmpresaCreateForm() {
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
      const result = await createEmpresaAction(null, formData);
      if (result?.ok) {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result?.message ?? "Não foi possível salvar a empresa.");
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
        className="w-fit rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        {open ? "Cancelar" : "Nova empresa"}
      </button>

      {open ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-4 text-base font-semibold text-neutral-900">Cadastrar empresa</h3>
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome *">
                <input name="name" type="text" required placeholder="Nome da empresa" className={inputCls} />
              </Field>
              <Field label="Documento (CPF/CNPJ)">
                <input name="documento" type="text" placeholder="00.000.000/0000-00" className={inputCls} />
              </Field>
              <Field label="Telefone">
                <input name="telefone" type="tel" placeholder="(11) 91234-5678" className={inputCls} />
              </Field>
              <Field label="Website">
                <input name="website" type="url" placeholder="https://..." className={inputCls} />
              </Field>
              <Field label="Segmento">
                <select name="segmento" defaultValue="" className={inputCls}>
                  <option value="">—</option>
                  {SEGMENTO.map((s) => (
                    <option key={s} value={s}>
                      {SEGMENTO_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Origem">
                <select name="origemDoLead" defaultValue="" className={inputCls}>
                  <option value="">—</option>
                  {ORIGEM.map((o) => (
                    <option key={o} value={o}>
                      {ORIGEM_LABELS[o]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status do cliente">
                <select name="statusDoCliente" defaultValue="lead" className={inputCls}>
                  {STATUS_CLIENTE.map((st) => (
                    <option key={st} value={st}>
                      {STATUS_CLIENTE_LABELS[st]}
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
                {isPending ? "Salvando..." : "Criar empresa"}
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

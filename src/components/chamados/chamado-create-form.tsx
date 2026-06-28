"use client";
// src/components/chamados/chamado-create-form.tsx — novo chamado (suporte de uma empresa).
// Padrao do Prospect: useTransition + chamada direta da action (sem useActionState/efeito).
// Empresa e titulo obrigatorios. Prioridade default media.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PRIORIDADE_CHAMADO_LABELS } from "@/lib/crm/labels";
import { PRIORIDADE_CHAMADO } from "@/lib/validators";
import { createChamadoAction } from "@/server/actions/chamados.actions";

export type EmpresaOption = { id: string; name: string };

export function ChamadoCreateForm({ empresas }: { empresas: EmpresaOption[] }) {
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
      const result = await createChamadoAction(null, formData);
      if (result?.ok) {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result?.message ?? "Não foi possível abrir o chamado.");
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
        title={noEmpresas ? "Cadastre uma empresa antes de abrir um chamado." : undefined}
        className="w-fit rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {open ? "Cancelar" : "Novo chamado"}
      </button>

      {noEmpresas ? (
        <p className="text-xs text-neutral-500">Cadastre uma empresa antes de abrir um chamado.</p>
      ) : null}

      {open ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-4 text-base font-semibold text-neutral-900">Novo chamado</h3>
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
              <Field label="Prioridade">
                <select name="prioridade" defaultValue="media" className={inputCls}>
                  {PRIORIDADE_CHAMADO.map((p) => (
                    <option key={p} value={p}>
                      {PRIORIDADE_CHAMADO_LABELS[p]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Título *">
                <input name="titulo" type="text" required placeholder="Resumo do problema" className={inputCls} />
              </Field>
              <Field label="Descrição">
                <textarea
                  name="descricao"
                  rows={3}
                  placeholder="Detalhe o que está acontecendo."
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
                {isPending ? "Salvando..." : "Abrir chamado"}
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

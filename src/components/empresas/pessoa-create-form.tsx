"use client";
// src/components/empresas/pessoa-create-form.tsx — form de novo contato (pessoa) de uma empresa.
// Padrao do projeto: useTransition + chamada direta da action. Em sucesso fecha, reseta e refresh.
// A empresa vem fixa do Server Component (record page) via prop, embutida em hidden empresaId.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPessoaAction } from "@/server/actions/pessoas.actions";

export function PessoaCreateForm({ empresaId }: { empresaId: string }) {
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
      const result = await createPessoaAction(null, formData);
      if (result?.ok) {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result?.message ?? "Não foi possível salvar o contato.");
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
        {open ? "Cancelar" : "Novo contato"}
      </button>

      {open ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-4 text-base font-semibold text-neutral-900">Novo contato</h3>
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input type="hidden" name="empresaId" value={empresaId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome *">
                <input name="firstName" type="text" required placeholder="Nome" className={inputCls} />
              </Field>
              <Field label="Sobrenome">
                <input name="lastName" type="text" placeholder="Sobrenome" className={inputCls} />
              </Field>
              <Field label="E-mail">
                <input name="email" type="email" placeholder="nome@empresa.com" className={inputCls} />
              </Field>
              <Field label="Telefone">
                <input name="phone" type="tel" placeholder="(11) 91234-5678" className={inputCls} />
              </Field>
              <Field label="Documento (CPF)">
                <input name="documento" type="text" placeholder="000.000.000-00" className={inputCls} />
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Salvando..." : "Adicionar contato"}
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

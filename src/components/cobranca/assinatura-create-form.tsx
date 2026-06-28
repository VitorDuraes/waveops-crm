"use client";
// src/components/cobranca/assinatura-create-form.tsx — nova assinatura (vinculo Empresa<->Plano).
// Padrao do Prospect: useTransition + chamada direta da action (sem useActionState/efeito).
// Valor mensal e opcional quando ha plano (o repo copia o preco do plano como snapshot do MRR).
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STATUS_ASSINATURA_LABELS } from "@/lib/crm/labels";
import { STATUS_ASSINATURA } from "@/lib/validators";
import { formatBRLFromCents } from "@/lib/crm/format";
import { createAssinaturaAction } from "@/server/actions/assinaturas.actions";

export type EmpresaOption = { id: string; name: string };
export type PlanoOption = { id: string; name: string; precoMensalCents: number };

export function AssinaturaCreateForm({
  empresas,
  planos,
}: {
  empresas: EmpresaOption[];
  planos: PlanoOption[];
}) {
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
      const result = await createAssinaturaAction(null, formData);
      if (result?.ok) {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result?.message ?? "Não foi possível criar a assinatura.");
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
        title={noEmpresas ? "Cadastre uma empresa antes de criar uma assinatura." : undefined}
        className="w-fit rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {open ? "Cancelar" : "Nova assinatura"}
      </button>

      {noEmpresas ? (
        <p className="text-xs text-neutral-500">Cadastre uma empresa antes de criar uma assinatura.</p>
      ) : null}

      {open ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-4 text-base font-semibold text-neutral-900">Nova assinatura</h3>
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
              <Field label="Plano">
                <select name="planoId" defaultValue="" className={inputCls}>
                  <option value="">Selecione...</option>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {`${p.name} (${formatBRLFromCents(p.precoMensalCents)})`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor mensal">
                <input name="valorMensal" type="text" placeholder="R$ 997,00" className={inputCls} />
              </Field>
              <Field label="Status">
                <select name="status" defaultValue="ativo" className={inputCls}>
                  {STATUS_ASSINATURA.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_ASSINATURA_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Data de inicio">
                <input name="dataInicio" type="date" className={inputCls} />
              </Field>
              <Field label="Proximo vencimento">
                <input name="proximoVencimento" type="date" className={inputCls} />
              </Field>
            </div>

            <p className="text-xs text-neutral-500">
              Informe o plano ou o valor mensal. Com plano escolhido, o valor pode ficar em branco.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Salvando..." : "Criar assinatura"}
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

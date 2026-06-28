"use client";
// src/components/cobranca/assinaturas-table.tsx — tabela de assinaturas com badge de status.
// Acao por linha (Ativa/Pausar/Cancelar) chama updateAssinaturaStatusAction e da router.refresh.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STATUS_ASSINATURA_LABELS } from "@/lib/crm/labels";
import { formatBRLFromCents } from "@/lib/crm/format";
import type { StatusAssinatura } from "@/lib/validators";
import type { AssinaturaComContexto } from "@/server/assinaturas";
import { updateAssinaturaStatusAction } from "@/server/actions/assinaturas.actions";

// Cor (classes Tailwind) por status da assinatura.
const STATUS_STYLES: Record<StatusAssinatura, string> = {
  ativo: "bg-emerald-100 text-emerald-800",
  pendente: "bg-amber-100 text-amber-800",
  vencido: "bg-rose-100 text-rose-800",
  pausado: "bg-sky-100 text-sky-800",
  cancelado: "bg-neutral-200 text-neutral-600",
};

function statusLabel(status: string): string {
  return STATUS_ASSINATURA_LABELS[status as StatusAssinatura] ?? status;
}

function statusStyle(status: string): string {
  return STATUS_STYLES[status as StatusAssinatura] ?? "bg-neutral-100 text-neutral-700";
}

// Acao por status atual: oferece so as transicoes que fazem sentido.
const ACOES: { toStatus: StatusAssinatura; label: string }[] = [
  { toStatus: "ativo", label: "Marcar ativa" },
  { toStatus: "pausado", label: "Pausar" },
  { toStatus: "cancelado", label: "Cancelar" },
];

export function AssinaturasTable({ assinaturas }: { assinaturas: AssinaturaComContexto[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function mudarStatus(id: string, toStatus: StatusAssinatura) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await updateAssinaturaStatusAction(id, toStatus);
      if (!result.ok) {
        setError("Não foi possível alterar o status. Tente novamente.");
      }
      setPendingId(null);
      router.refresh();
    });
  }

  if (assinaturas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        Nenhuma assinatura ainda. Use o botão Nova assinatura para começar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Valor mensal</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100" aria-busy={isPending}>
            {assinaturas.map((a) => {
              const busy = isPending && pendingId === a.id;
              return (
                <tr key={a.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{a.empresaName}</td>
                  <td className="px-4 py-3 text-neutral-600">{a.planoName ?? "-"}</td>
                  <td className="px-4 py-3 tabular-nums text-neutral-700">
                    {formatBRLFromCents(a.valorMensalCents)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(a.status)}`}
                    >
                      {statusLabel(a.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {ACOES.filter((acao) => acao.toStatus !== a.status).map((acao) => (
                        <button
                          key={acao.toStatus}
                          type="button"
                          onClick={() => mudarStatus(a.id, acao.toStatus)}
                          disabled={busy}
                          className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? "Salvando..." : acao.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

"use client";
// src/components/cobranca/faturas-table.tsx — tabela de faturas com badge de status.
// Acao por linha "Marcar paga" (so quando status != paga) chama marcarFaturaPagaAction e refresh.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STATUS_FATURA_LABELS } from "@/lib/crm/labels";
import { formatBRLFromCents } from "@/lib/crm/format";
import type { StatusFatura } from "@/lib/validators";
import type { FaturaComEmpresa } from "@/server/faturas";
import { marcarFaturaPagaAction } from "@/server/actions/faturas.actions";

// Cor (classes Tailwind) por status da fatura.
const STATUS_STYLES: Record<StatusFatura, string> = {
  criada: "bg-neutral-100 text-neutral-700",
  em_aberto: "bg-amber-100 text-amber-800",
  paga: "bg-emerald-100 text-emerald-800",
  vencida: "bg-rose-100 text-rose-800",
  cancelada: "bg-neutral-200 text-neutral-600",
  estornada: "bg-sky-100 text-sky-800",
  reembolsada: "bg-sky-100 text-sky-800",
};

function statusLabel(status: string): string {
  return STATUS_FATURA_LABELS[status as StatusFatura] ?? status;
}

function statusStyle(status: string): string {
  return STATUS_STYLES[status as StatusFatura] ?? "bg-neutral-100 text-neutral-700";
}

function formatDate(value: Date | string | null): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function FaturasTable({ faturas }: { faturas: FaturaComEmpresa[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function marcarPaga(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await marcarFaturaPagaAction(id);
      if (!result.ok) {
        setError("Não foi possível marcar a fatura como paga. Tente novamente.");
      }
      setPendingId(null);
      router.refresh();
    });
  }

  if (faturas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        Nenhuma fatura ainda. Use o botão Nova fatura para começar.
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
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100" aria-busy={isPending}>
            {faturas.map((f) => {
              const busy = isPending && pendingId === f.id;
              const paga = f.status === "paga";
              return (
                <tr key={f.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{f.empresaName}</td>
                  <td className="px-4 py-3 tabular-nums text-neutral-700">
                    {formatBRLFromCents(f.valorCents)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-neutral-600">{formatDate(f.vencimento)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(f.status)}`}
                    >
                      {statusLabel(f.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!paga ? (
                      <button
                        type="button"
                        onClick={() => marcarPaga(f.id)}
                        disabled={busy}
                        className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy ? "Salvando..." : "Marcar paga"}
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-400">-</span>
                    )}
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

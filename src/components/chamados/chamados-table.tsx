"use client";
// src/components/chamados/chamados-table.tsx — tabela de chamados (suporte) com badges.
// Acoes por linha avancam o status via updateChamadoStatusAction (nao mostra a acao do status atual).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PRIORIDADE_CHAMADO_LABELS, STATUS_CHAMADO_LABELS } from "@/lib/crm/labels";
import type { PrioridadeChamado, StatusChamado } from "@/lib/validators";
import type { ChamadoComEmpresa } from "@/server/chamados";
import { updateChamadoStatusAction } from "@/server/actions/chamados.actions";

// Cor (classes Tailwind) por status do chamado.
const STATUS_STYLES: Record<StatusChamado, string> = {
  aberto: "bg-amber-100 text-amber-800",
  em_andamento: "bg-sky-100 text-sky-800",
  resolvido: "bg-emerald-100 text-emerald-800",
  fechado: "bg-neutral-200 text-neutral-600",
};

// Cor (classes Tailwind) por prioridade do chamado.
const PRIORIDADE_STYLES: Record<PrioridadeChamado, string> = {
  baixa: "bg-neutral-100 text-neutral-700",
  media: "bg-sky-100 text-sky-800",
  alta: "bg-rose-100 text-rose-800",
};

// Acoes de avanco de status por linha. Cada uma so aparece quando o status atual difere do alvo.
const ACOES: { toStatus: StatusChamado; label: string }[] = [
  { toStatus: "em_andamento", label: "Em andamento" },
  { toStatus: "resolvido", label: "Resolver" },
  { toStatus: "fechado", label: "Fechar" },
];

function statusLabel(status: string): string {
  return STATUS_CHAMADO_LABELS[status as StatusChamado] ?? status;
}

function statusStyle(status: string): string {
  return STATUS_STYLES[status as StatusChamado] ?? "bg-neutral-100 text-neutral-700";
}

function prioridadeLabel(prioridade: string): string {
  return PRIORIDADE_CHAMADO_LABELS[prioridade as PrioridadeChamado] ?? prioridade;
}

function prioridadeStyle(prioridade: string): string {
  return PRIORIDADE_STYLES[prioridade as PrioridadeChamado] ?? "bg-neutral-100 text-neutral-700";
}

export function ChamadosTable({ chamados }: { chamados: ChamadoComEmpresa[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function avancarStatus(id: string, toStatus: StatusChamado) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await updateChamadoStatusAction(id, toStatus);
      setPendingId(null);
      if (result.ok) {
        router.refresh();
      } else {
        setError("Não foi possível mudar o status do chamado. Tente novamente.");
      }
    });
  }

  if (chamados.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        Nenhum chamado ainda. Use o botão Novo chamado para começar.
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
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Prioridade</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100" aria-busy={isPending}>
            {chamados.map((c) => {
              const busy = isPending && pendingId === c.id;
              const acoes = ACOES.filter((a) => a.toStatus !== c.status);
              return (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{c.empresaName}</td>
                  <td className="px-4 py-3 text-neutral-700">{c.titulo}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${prioridadeStyle(c.prioridade)}`}
                    >
                      {prioridadeLabel(c.prioridade)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(c.status)}`}
                    >
                      {statusLabel(c.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {acoes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {acoes.map((a) => (
                          <button
                            key={a.toStatus}
                            type="button"
                            onClick={() => avancarStatus(c.id, a.toStatus)}
                            disabled={busy}
                            className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy ? "Salvando..." : a.label}
                          </button>
                        ))}
                      </div>
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

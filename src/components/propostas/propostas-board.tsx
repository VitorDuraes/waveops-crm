"use client";
// src/components/propostas/propostas-board.tsx — Kanban de propostas com drag-and-drop HTML5 NATIVO (sem lib).
// Arrastar um card para outra coluna chama movePropostaAction (server) e revalida /propostas.
// Optimistic UI: move o card na hora; se a action falhar, reverte e mostra o erro.
import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLANO_LABELS, STATUS_PROPOSTA_LABELS } from "@/lib/crm/labels";
import { formatBRLFromCents } from "@/lib/crm/format";
import { STATUS_PROPOSTA } from "@/lib/validators";
import type { Plano, StatusProposta } from "@/lib/validators";
import type { PropostaComContexto } from "@/server/propostas";
import { movePropostaAction } from "@/server/actions/propostas.actions";

type Move = { id: string; toStatus: StatusProposta };

export function PropostasBoard({ propostas }: { propostas: PropostaComContexto[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<StatusProposta | null>(null);

  // Estado otimista: aplica o move localmente enquanto a action roda.
  const [optimisticPropostas, applyOptimisticMove] = useOptimistic(
    propostas,
    (current, move: Move) =>
      current.map((p) => (p.id === move.id ? { ...p, status: move.toStatus } : p)),
  );

  function onDrop(toStatus: StatusProposta) {
    setOverStatus(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;

    const proposta = optimisticPropostas.find((p) => p.id === id);
    if (!proposta || proposta.status === toStatus) return;

    setError(null);
    startTransition(async () => {
      applyOptimisticMove({ id, toStatus });
      const result = await movePropostaAction(id, toStatus);
      if (!result.ok) {
        setError("Não foi possível mover a proposta. Tente novamente.");
      }
      // Resync com o servidor (confirma o move ou reverte o otimista em caso de erro).
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-2" aria-busy={isPending}>
        {STATUS_PROPOSTA.map((status) => {
          const columnCards = optimisticPropostas.filter((p) => p.status === status);
          const isOver = overStatus === status;
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                if (overStatus !== status) setOverStatus(status);
              }}
              onDragLeave={(e) => {
                // So limpa se realmente saiu da coluna (nao ao passar sobre um filho).
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStatus(null);
              }}
              onDrop={() => onDrop(status)}
              className={`flex w-64 flex-none flex-col rounded-xl border bg-neutral-50 transition-colors ${
                isOver ? "border-[var(--color-brand)] bg-violet-50" : "border-neutral-200"
              }`}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2.5">
                <span className="text-sm font-semibold text-neutral-800">
                  {STATUS_PROPOSTA_LABELS[status]}
                </span>
                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600">
                  {columnCards.length}
                </span>
              </div>

              <div className="flex min-h-24 flex-col gap-2 p-2">
                {columnCards.map((card) => (
                  <article
                    key={card.id}
                    draggable
                    onDragStart={() => setDragId(card.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStatus(null);
                    }}
                    className={`cursor-grab rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-opacity active:cursor-grabbing ${
                      dragId === card.id ? "opacity-50" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-neutral-900">{card.name}</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{card.empresaName}</p>
                    <p className="truncate text-xs text-neutral-400">{card.oportunidadeName}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-700">
                        {formatBRLFromCents(card.valorMensalCents)}
                      </span>
                      {card.plano ? (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                          {PLANO_LABELS[card.plano as Plano]}
                        </span>
                      ) : null}
                    </div>
                    <Link
                      href={`/oportunidades/${card.oportunidadeId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 block text-right text-xs font-medium text-[var(--color-brand)] hover:underline"
                    >
                      Abrir oportunidade
                    </Link>
                  </article>
                ))}

                {columnCards.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-neutral-400">Vazio</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

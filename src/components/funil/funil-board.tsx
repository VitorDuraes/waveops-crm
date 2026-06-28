"use client";
// src/components/funil/funil-board.tsx — Kanban do funil com drag-and-drop HTML5 NATIVO (sem lib).
// Arrastar um card para outra coluna chama moveOportunidadeAction (server) e revalida /funil.
// Optimistic UI: move o card na hora; se a action falhar, reverte e mostra o erro.
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STAGE_LABELS } from "@/lib/crm/labels";
import { stagesInOrder } from "@/lib/crm/stage";
import { formatBRLFromCents, formatPercent } from "@/lib/crm/format";
import type { Stage } from "@/lib/validators";
import { moveOportunidadeAction } from "@/server/actions/oportunidades.actions";

export type FunilCard = {
  id: string;
  name: string;
  empresaName: string;
  stage: Stage;
  valorMensalEstimadoCents: number | null;
  probabilidade: number | null;
};

type Move = { id: string; toStage: Stage };

export function FunilBoard({ cards }: { cards: FunilCard[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  // Estado otimista: aplica o move localmente enquanto a action roda.
  const [optimisticCards, applyOptimisticMove] = useOptimistic(cards, (current, move: Move) =>
    current.map((c) => (c.id === move.id ? { ...c, stage: move.toStage } : c)),
  );

  const stages = stagesInOrder();

  function onDrop(toStage: Stage) {
    setOverStage(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;

    const card = optimisticCards.find((c) => c.id === id);
    if (!card || card.stage === toStage) return;

    setError(null);
    startTransition(async () => {
      applyOptimisticMove({ id, toStage });
      const result = await moveOportunidadeAction(id, toStage);
      if (!result.ok) {
        setError("Não foi possível mover a oportunidade. Tente novamente.");
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
        {stages.map((stage) => {
          const columnCards = optimisticCards.filter((c) => c.stage === stage);
          const isOver = overStage === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                if (overStage !== stage) setOverStage(stage);
              }}
              onDragLeave={(e) => {
                // So limpa se realmente saiu da coluna (nao ao passar sobre um filho).
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
              }}
              onDrop={() => onDrop(stage)}
              className={`flex w-64 flex-none flex-col rounded-xl border bg-neutral-50 transition-colors ${
                isOver ? "border-[var(--color-brand)] bg-violet-50" : "border-neutral-200"
              }`}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2.5">
                <span className="text-sm font-semibold text-neutral-800">{STAGE_LABELS[stage]}</span>
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
                      setOverStage(null);
                    }}
                    className={`cursor-grab rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-opacity active:cursor-grabbing ${
                      dragId === card.id ? "opacity-50" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-neutral-900">{card.name}</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{card.empresaName}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-700">
                        {formatBRLFromCents(card.valorMensalEstimadoCents)}
                      </span>
                      {card.probabilidade != null ? (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                          {formatPercent(card.probabilidade)}
                        </span>
                      ) : null}
                    </div>
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

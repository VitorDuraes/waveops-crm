"use client";
// src/components/ui/kanban.tsx — Kanban reutilizavel (funil, propostas) com drag-and-drop HTML5 nativo.
// Layout em GRID: todas as colunas cabem na largura, SEM rolagem horizontal. Altura cheia, com
// scroll vertical DENTRO de cada coluna. Optimistic UI: move na hora; em erro, reverte e avisa.
import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type KanbanColumn<K extends string> = {
  key: K;
  label: string;
  dot: string; // cor da bolinha de acento (ex: "bg-sky-400")
  badge: string; // classes do contador (ex: "bg-sky-100 text-sky-700")
  over: string; // classes da coluna quando arrastam por cima (ex: "border-sky-300 bg-sky-50")
};

export type KanbanItem<K extends string> = { id: string; column: K };

export function KanbanBoard<K extends string, T extends KanbanItem<K>>({
  items,
  columns,
  onMove,
  renderCard,
  columnSummary,
  moveErrorLabel,
}: {
  items: T[];
  columns: readonly KanbanColumn<K>[];
  onMove: (id: string, toColumn: K) => Promise<{ ok: boolean }>;
  renderCard: (item: T) => ReactNode;
  columnSummary?: (items: T[]) => string | null;
  moveErrorLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<K | null>(null);

  const [optimistic, applyMove] = useOptimistic(items, (current, move: { id: string; to: K }) =>
    current.map((c) => (c.id === move.id ? { ...c, column: move.to } : c)),
  );

  function handleDrop(toColumn: K) {
    setOverKey(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;

    const card = optimistic.find((c) => c.id === id);
    if (!card || card.column === toColumn) return;

    setError(null);
    startTransition(async () => {
      applyMove({ id, to: toColumn });
      const result = await onMove(id, toColumn);
      if (!result.ok) setError(moveErrorLabel);
      // Resync com o servidor (confirma o move ou reverte o otimista em caso de erro).
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error ? (
        <p
          role="alert"
          className="flex-none rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      <div
        className="grid min-h-[26rem] flex-1 auto-rows-fr gap-2"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        aria-busy={isPending}
      >
        {columns.map((col) => {
          const colItems = optimistic.filter((c) => c.column === col.key);
          const isOver = overKey === col.key;
          const summary = columnSummary?.(colItems) ?? null;
          return (
            <section
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                if (overKey !== col.key) setOverKey(col.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverKey(null);
              }}
              onDrop={() => handleDrop(col.key)}
              className={`flex min-h-0 flex-col rounded-2xl border bg-neutral-50/70 transition-colors ${
                isOver ? col.over : "border-neutral-200"
              }`}
            >
              <header className="flex-none border-b border-neutral-200 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 flex-none rounded-full ${col.dot}`} aria-hidden />
                  <span className="truncate text-sm font-semibold text-neutral-800">{col.label}</span>
                  <span
                    className={`ml-auto flex-none rounded-full px-2 py-0.5 text-xs font-semibold ${col.badge}`}
                  >
                    {colItems.length}
                  </span>
                </div>
                {summary ? (
                  <p className="mt-1 truncate text-xs font-medium text-neutral-500">{summary}</p>
                ) : null}
              </header>

              <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
                {colItems.map((item) => (
                  <article
                    key={item.id}
                    draggable
                    onDragStart={() => setDragId(item.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverKey(null);
                    }}
                    className={`cursor-grab rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md active:cursor-grabbing ${
                      dragId === item.id ? "opacity-50" : ""
                    }`}
                  >
                    {renderCard(item)}
                  </article>
                ))}

                {colItems.length === 0 ? (
                  <p
                    className={`m-auto rounded-lg px-2 py-6 text-center text-xs ${
                      isOver ? "text-neutral-500" : "text-neutral-400"
                    }`}
                  >
                    {isOver ? "Solte aqui" : "Vazio"}
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

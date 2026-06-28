"use client";
// src/components/funil/funil-board.tsx — Kanban do funil. Usa o KanbanBoard reutilizavel (grid sem
// rolagem horizontal). Cor por estagio + total (R$/mes) por coluna. Drag-and-drop move o estagio.
import Link from "next/link";
import { STAGE_LABELS } from "@/lib/crm/labels";
import { stagesInOrder } from "@/lib/crm/stage";
import { formatBRLFromCents, formatPercent } from "@/lib/crm/format";
import type { Stage } from "@/lib/validators";
import { moveOportunidadeAction } from "@/server/actions/oportunidades.actions";
import { KanbanBoard, type KanbanColumn } from "@/components/ui/kanban";

export type FunilCard = {
  id: string;
  name: string;
  empresaName: string;
  stage: Stage;
  valorMensalEstimadoCents: number | null;
  probabilidade: number | null;
};

// Cor de acento por estagio (bolinha, contador e destaque de drop).
const STAGE_STYLES: Record<Stage, { dot: string; badge: string; over: string }> = {
  novo_lead: { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700", over: "border-slate-300 bg-slate-50" },
  contato_feito: { dot: "bg-sky-400", badge: "bg-sky-100 text-sky-700", over: "border-sky-300 bg-sky-50" },
  diagnostico: { dot: "bg-violet-400", badge: "bg-violet-100 text-violet-700", over: "border-violet-300 bg-violet-50" },
  proposta_enviada: { dot: "bg-indigo-400", badge: "bg-indigo-100 text-indigo-700", over: "border-indigo-300 bg-indigo-50" },
  negociacao: { dot: "bg-amber-400", badge: "bg-amber-100 text-amber-700", over: "border-amber-300 bg-amber-50" },
  ganho: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700", over: "border-emerald-300 bg-emerald-50" },
  perdido: { dot: "bg-rose-400", badge: "bg-rose-100 text-rose-700", over: "border-rose-300 bg-rose-50" },
};

type FunilItem = FunilCard & { column: Stage };

export function FunilBoard({ cards }: { cards: FunilCard[] }) {
  const items: FunilItem[] = cards.map((c) => ({ ...c, column: c.stage }));
  const columns: KanbanColumn<Stage>[] = stagesInOrder().map((s) => ({
    key: s,
    label: STAGE_LABELS[s],
    ...STAGE_STYLES[s],
  }));

  return (
    <KanbanBoard
      items={items}
      columns={columns}
      moveErrorLabel="Não foi possível mover a oportunidade. Tente novamente."
      onMove={(id, toColumn) => moveOportunidadeAction(id, toColumn)}
      columnSummary={(its) => {
        const total = its.reduce((s, c) => s + (c.valorMensalEstimadoCents ?? 0), 0);
        return total > 0 ? `${formatBRLFromCents(total)}/mês` : null;
      }}
      renderCard={(card) => (
        <>
          <Link
            href={`/oportunidades/${card.id}`}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className="block truncate text-sm font-semibold text-neutral-900 hover:text-[var(--color-brand)]"
          >
            {card.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-neutral-500">{card.empresaName}</p>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-neutral-800">
              {formatBRLFromCents(card.valorMensalEstimadoCents)}
            </span>
            {card.probabilidade != null ? (
              <span className="flex-none rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                {formatPercent(card.probabilidade)}
              </span>
            ) : null}
          </div>
        </>
      )}
    />
  );
}

"use client";
// src/components/propostas/propostas-board.tsx — Kanban de propostas. Usa o KanbanBoard reutilizavel
// (grid sem rolagem horizontal). Cor por status + total (R$/mes) por coluna. Drag-and-drop move o status.
import Link from "next/link";
import { PLANO_LABELS, STATUS_PROPOSTA_LABELS } from "@/lib/crm/labels";
import { formatBRLFromCents } from "@/lib/crm/format";
import { STATUS_PROPOSTA } from "@/lib/validators";
import type { Plano, StatusProposta } from "@/lib/validators";
import type { PropostaComContexto } from "@/server/propostas";
import { movePropostaAction } from "@/server/actions/propostas.actions";
import { KanbanBoard, type KanbanColumn } from "@/components/ui/kanban";

// Cor de acento por status (bolinha, contador e destaque de drop).
const STATUS_STYLES: Record<StatusProposta, { dot: string; badge: string; over: string }> = {
  rascunho: { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700", over: "border-slate-300 bg-slate-50" },
  enviada: { dot: "bg-sky-400", badge: "bg-sky-100 text-sky-700", over: "border-sky-300 bg-sky-50" },
  aceita: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700", over: "border-emerald-300 bg-emerald-50" },
  recusada: { dot: "bg-rose-400", badge: "bg-rose-100 text-rose-700", over: "border-rose-300 bg-rose-50" },
  expirada: { dot: "bg-neutral-400", badge: "bg-neutral-200 text-neutral-600", over: "border-neutral-300 bg-neutral-100" },
};

type PropostaItem = PropostaComContexto & { column: StatusProposta };

export function PropostasBoard({ propostas }: { propostas: PropostaComContexto[] }) {
  const items: PropostaItem[] = propostas.map((p) => ({ ...p, column: p.status as StatusProposta }));
  const columns: KanbanColumn<StatusProposta>[] = STATUS_PROPOSTA.map((s) => ({
    key: s,
    label: STATUS_PROPOSTA_LABELS[s],
    ...STATUS_STYLES[s],
  }));

  return (
    <KanbanBoard
      items={items}
      columns={columns}
      moveErrorLabel="Não foi possível mover a proposta. Tente novamente."
      onMove={(id, toColumn) => movePropostaAction(id, toColumn)}
      columnSummary={(its) => {
        const total = its.reduce((s, c) => s + (c.valorMensalCents ?? 0), 0);
        return total > 0 ? `${formatBRLFromCents(total)}/mês` : null;
      }}
      renderCard={(card) => (
        <>
          <Link
            href={`/oportunidades/${card.oportunidadeId}`}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className="block truncate text-sm font-semibold text-neutral-900 hover:text-[var(--color-brand)]"
          >
            {card.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-neutral-500">{card.empresaName}</p>
          <p className="truncate text-xs text-neutral-400">{card.oportunidadeName}</p>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-neutral-800">
              {formatBRLFromCents(card.valorMensalCents)}
            </span>
            {card.plano ? (
              <span className="flex-none rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                {PLANO_LABELS[card.plano as Plano]}
              </span>
            ) : null}
          </div>
        </>
      )}
    />
  );
}

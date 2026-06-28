// src/components/ui/badge.tsx — badges PT-BR do CRM. Componentes puros (Server-safe).
// Cor por status do cliente. Segmento em badge neutro. Labels sempre de @/lib/crm/labels.
import { SEGMENTO_LABELS, STATUS_CLIENTE_LABELS } from "@/lib/crm/labels";
import type { Segmento, StatusCliente } from "@/lib/validators";

// Cor (classes Tailwind) por status do cliente.
const STATUS_STYLES: Record<StatusCliente, string> = {
  lead: "bg-neutral-100 text-neutral-700",
  aguardando: "bg-amber-100 text-amber-800",
  ativo: "bg-emerald-100 text-emerald-800",
  pendente: "bg-amber-100 text-amber-800",
  vencido: "bg-rose-100 text-rose-800",
  pausado: "bg-sky-100 text-sky-800",
  cancelado: "bg-neutral-200 text-neutral-600",
};

export function StatusClienteBadge({ status }: { status: StatusCliente }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_CLIENTE_LABELS[status]}
    </span>
  );
}

export function SegmentoBadge({ segmento }: { segmento: Segmento | null }) {
  if (!segmento) return <span className="text-xs text-neutral-400">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
      {SEGMENTO_LABELS[segmento]}
    </span>
  );
}

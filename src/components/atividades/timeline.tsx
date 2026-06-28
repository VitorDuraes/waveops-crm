// src/components/atividades/timeline.tsx - timeline vertical de auditoria (mais recente no topo).
// Gera descricao PT-BR a partir de acao/entidade/antes/depois de cada AuditEntry.
// antes/depois sao jsonb (unknown): cast seguro para ler stage/status como string.
import { STAGE_LABELS, STATUS_PROPOSTA_LABELS } from "@/lib/crm/labels";
import type { Stage, StatusProposta } from "@/lib/validators";
import type { AuditEntry } from "@/server/audit";

// Le um campo string de um payload jsonb desconhecido, sem quebrar em null/array/primitivo.
function readString(payload: unknown, key: string): string | null {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return null;
}

function labelStage(value: string | null): string {
  if (!value) return value ?? "-";
  return STAGE_LABELS[value as Stage] ?? value;
}

function labelStatusProposta(value: string | null): string {
  if (!value) return value ?? "-";
  return STATUS_PROPOSTA_LABELS[value as StatusProposta] ?? value;
}

// Descricao em PT-BR do evento a partir de acao/entidade/antes/depois.
function describe(entry: AuditEntry): string {
  switch (entry.acao) {
    case "mover_estagio": {
      const de = readString(entry.antes, "stage");
      const para = readString(entry.depois, "stage");
      const deLabel = entry.entidade === "oportunidade" ? labelStage(de) : de ?? "-";
      const paraLabel = entry.entidade === "oportunidade" ? labelStage(para) : para ?? "-";
      return `Moveu o estágio de ${deLabel} para ${paraLabel}`;
    }
    case "mudar_status": {
      const para = readString(entry.depois, "status");
      const paraLabel = entry.entidade === "proposta" ? labelStatusProposta(para) : para ?? "-";
      return `Mudou o status para ${paraLabel}`;
    }
    case "nota":
      return "Adicionou uma nota";
    case "criar":
      return `Criou ${entry.entidade}`;
    default:
      return entry.acao;
  }
}

function formatDateTime(at: Date | string): string {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function Timeline({
  events,
  actorNames,
}: {
  events: AuditEntry[];
  actorNames: Record<string, string>;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-neutral-400">Sem atividade registrada ainda.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {events.map((entry) => {
        const autor = entry.actorId ? actorNames[entry.actorId] ?? "Sistema" : "Sistema";
        return (
          <li key={entry.id} className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[var(--color-brand)]" />
            <div className="flex min-w-0 flex-col">
              <p className="text-sm text-neutral-900">{describe(entry)}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {autor} · {formatDateTime(entry.at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

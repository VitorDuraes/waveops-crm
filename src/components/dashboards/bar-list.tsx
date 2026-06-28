// src/components/dashboards/bar-list.tsx — lista de barras horizontais (Server-safe).
// Largura proporcional ao maior count (style width %). Valor opcional em BRL via formatBRLFromCents.
// So Tailwind. Labels ja vem traduzidos do Server Component.
import { formatBRLFromCents } from "@/lib/crm/format";

export type BarItem = { label: string; count: number; valor?: number | null };

export function BarList({ items }: { items: BarItem[] }) {
  if (items.length === 0) {
    return <p className="px-1 py-4 text-center text-xs text-neutral-400">Sem dados.</p>;
  }

  const maxCount = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const width = `${Math.round((item.count / maxCount) * 100)}%`;
        return (
          <div key={item.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-700">{item.label}</span>
              <span className="flex items-center gap-2 text-neutral-500">
                {item.valor != null ? (
                  <span className="font-medium text-neutral-700">{formatBRLFromCents(item.valor)}</span>
                ) : null}
                <span className="tabular-nums">{item.count}</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

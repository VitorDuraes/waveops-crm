// src/components/dashboards/stat-card.tsx — card de metrica (Server-safe). Rotulo, valor grande e dica.
// So Tailwind. Destaque no valor com var(--color-brand). Labels e numeros vem prontos do Server Component.

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="text-2xl font-semibold text-[var(--color-brand)]">{value}</span>
      {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
    </div>
  );
}

"use client";
// src/components/dashboards/stat-card.tsx — card de metrica com numero animado (CountUp) e spotlight no hover.
// Recebe o valor NUMERICO + o tipo de formato (serializavel do Server Component). O formatador roda no client.
import { useRef, useState, type MouseEvent } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { formatBRLFromCents } from "@/lib/crm/format";

type StatFormat = "money" | "int" | "percent" | "days";

// Formatadores estaveis (referencia fixa por chave) usados pelo AnimatedNumber.
const FORMATTERS: Record<StatFormat, (n: number) => string> = {
  money: (n) => formatBRLFromCents(Math.round(n)),
  int: (n) => Math.round(n).toLocaleString("pt-BR"),
  percent: (n) => `${(Math.round(n * 10) / 10).toLocaleString("pt-BR")}%`,
  days: (n) => `${Math.round(n).toLocaleString("pt-BR")} dias`,
};

export function StatCard({
  label,
  value,
  format,
  hint,
  accent = false,
}: {
  label: string;
  value: number | null;
  format: StatFormat;
  hint?: string;
  accent?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [glow, setGlow] = useState(0);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  }

  const numberCls = accent
    ? "bg-linear-to-r from-brand to-indigo-600 bg-clip-text text-2xl font-semibold text-transparent"
    : "text-2xl font-semibold text-neutral-900";

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setGlow(1)}
      onMouseLeave={() => setGlow(0)}
      className="relative flex flex-col gap-1 overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 transition-shadow duration-300 hover:shadow-md hover:shadow-violet-100"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: glow * 0.9,
          background: `radial-gradient(220px circle at ${pos.x}px ${pos.y}px, rgba(124,58,237,0.10), transparent 70%)`,
        }}
      />
      <span className="relative text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {value == null ? (
        <span className="relative text-2xl font-semibold text-neutral-400">-</span>
      ) : (
        <AnimatedNumber value={value} format={FORMATTERS[format]} className={`relative ${numberCls}`} />
      )}
      {hint ? <span className="relative text-xs text-neutral-500">{hint}</span> : null}
    </div>
  );
}

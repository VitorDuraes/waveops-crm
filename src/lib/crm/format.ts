// src/lib/crm/format.ts - helpers PUROS de formatacao PT-BR para telas (sem PII em log).
// Valores monetarios sao guardados em centavos (integer) no banco e exibidos em BRL.

// Centavos (integer) -> "R$ 1.234,56". null/undefined -> traco.
export function formatBRLFromCents(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// "R$ 1.234,56" ou "1234,56" ou "1234.56" -> centavos (integer) | null.
// Aceita virgula ou ponto como separador decimal. Descarta o resto.
export function parseBRLToCents(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Remove tudo que nao for digito, virgula, ponto ou sinal.
  const cleaned = trimmed.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  // Normaliza para ponto decimal: se tem virgula, ela e o decimal (padrao BR).
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const reais = Number(normalized);
  if (!Number.isFinite(reais)) return null;
  return Math.round(reais * 100);
}

// "5511987654321" -> "+55 (11) 98765-4321". Mantem o valor cru se nao bater o formato.
export function formatPhoneBR(normalized: string | null | undefined): string {
  if (!normalized) return "-";
  const m = normalized.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (!m) return normalized;
  return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
}

// Probabilidade (0..100) -> "70%". null -> traco.
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${value}%`;
}

// src/lib/crm/stage.ts — helpers PUROS do funil (oportunidades.stage). Alvo natural de teste.
// Fonte de verdade dos valores: STAGE em src/lib/validators. Labels em src/lib/crm/labels.ts.
import { STAGE, type Stage } from "@/lib/validators";

// Estagio inicial de toda oportunidade nova.
export const DEFAULT_STAGE: Stage = "novo_lead";

// Type guard: o valor recebido (form, query, etc) e um Stage valido?
export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGE as readonly string[]).includes(value);
}

// Ordem das colunas do Kanban = ordem do array STAGE (novo_lead ... perdido).
export function stagesInOrder(): readonly Stage[] {
  return STAGE;
}

// Agrupa oportunidades por stage, preservando a ordem do array STAGE e garantindo
// uma chave para CADA estagio (coluna vazia continua existindo no Kanban).
export function groupByStage<T extends { stage: Stage }>(items: readonly T[]): Record<Stage, T[]> {
  const grouped = Object.fromEntries(STAGE.map((s) => [s, [] as T[]])) as Record<Stage, T[]>;
  for (const item of items) {
    // Defensivo: ignora um stage fora do dominio (nao deveria ocorrer, ha CHECK no banco).
    if (isStage(item.stage)) grouped[item.stage].push(item);
  }
  return grouped;
}

// src/lib/crm/segmento.ts — mapeador simples (por palavra-chave) de um texto livre de segmento
// para o enum SEGMENTO. Usado na ingestao de lead vindo do WaveOps Prospect, que manda o
// segmento como string solta. Helper PURO: alvo natural de teste, sem dependencia de banco.
// Fonte de verdade do enum: SEGMENTO em src/lib/validators. Labels em src/lib/crm/labels.ts.
import { SEGMENTO, type Segmento } from "@/lib/validators";

// Type guard: o texto recebido ja e exatamente um value do enum?
export function isSegmento(value: unknown): value is Segmento {
  return typeof value === "string" && (SEGMENTO as readonly string[]).includes(value);
}

// Remove acento e baixa a caixa, para casar "Imobiliária" / "imobiliaria" / "IMOBILIARIA".
// ̀-ͯ = bloco Unicode de marcas diacriticas combinantes (acentos apos NFD).
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Palavras-chave por segmento (ja sem acento). A ordem importa: a primeira que casar vence.
// Mantido simples de proposito: o objetivo e cair em "outro" quando nada bate, nunca falhar.
const KEYWORDS: ReadonlyArray<readonly [Segmento, readonly string[]]> = [
  ["clinica_saude", ["clinica", "saude", "odonto", "dental", "medic", "estetica", "hospital"]],
  ["imobiliaria", ["imobiliaria", "imovel", "imoveis", "corretor", "incorporador"]],
  ["agencia_marketing", ["agencia", "marketing", "trafego", "publicidade", "midia", "social media"]],
  ["ecommerce", ["ecommerce", "e-commerce", "loja virtual", "loja online", "varejo", "dropship"]],
  ["infoproduto", ["infoproduto", "infoprodutor", "curso online", "produtor digital", "lancamento"]],
  ["escola_educacao", ["escola", "educacao", "ensino", "faculdade", "curso", "treinamento"]],
  ["consultoria", ["consultoria", "consultor", "assessoria", "advocacia", "advogado", "contabil"]],
  ["time_suporte", ["suporte", "atendimento", "call center", "help desk", "sac"]],
  ["comercial_vendas", ["comercial", "vendas", "sdr", "prospeccao", "outbound"]],
];

/**
 * Mapeia um texto livre de segmento para um value do enum SEGMENTO.
 * - Vazio/nulo -> null (deixa o campo em branco).
 * - Casa exato com um value do enum -> retorna esse value.
 * - Casa por palavra-chave (sem acento, case-insensitive) -> retorna o segmento.
 * - Nada bate -> "outro" (nunca lanca; ingestao nao pode quebrar por segmento desconhecido).
 */
export function mapSegmento(raw: string | null | undefined): Segmento | null {
  const value = raw?.trim();
  if (!value) return null;
  if (isSegmento(value)) return value;

  const folded = fold(value);
  for (const [segmento, words] of KEYWORDS) {
    if (words.some((w) => folded.includes(w))) return segmento;
  }
  return "outro";
}

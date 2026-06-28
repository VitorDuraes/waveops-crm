import { describe, expect, it } from "vitest";
import { STAGE, type Stage } from "@/lib/validators";
import { DEFAULT_STAGE, groupByStage, isStage, stagesInOrder } from "./stage";

describe("DEFAULT_STAGE", () => {
  it("toda oportunidade nova comeca em novo_lead", () => {
    expect(DEFAULT_STAGE).toBe("novo_lead");
  });
});

describe("isStage", () => {
  it("aceita os 7 estagios validos", () => {
    for (const s of STAGE) expect(isStage(s)).toBe(true);
  });
  it("rejeita valor fora do dominio", () => {
    expect(isStage("nao_existe")).toBe(false);
    expect(isStage("")).toBe(false);
    expect(isStage(null)).toBe(false);
    expect(isStage(42)).toBe(false);
  });
});

describe("stagesInOrder", () => {
  it("retorna os 7 estagios na ordem do funil", () => {
    expect(stagesInOrder()).toEqual([
      "novo_lead",
      "contato_feito",
      "diagnostico",
      "proposta_enviada",
      "negociacao",
      "ganho",
      "perdido",
    ]);
  });
});

describe("groupByStage", () => {
  it("agrupa por stage e mantem uma chave para CADA estagio (coluna vazia inclusa)", () => {
    const items: { id: string; stage: Stage }[] = [
      { id: "a", stage: "novo_lead" },
      { id: "b", stage: "novo_lead" },
      { id: "c", stage: "negociacao" },
    ];
    const grouped = groupByStage(items);

    expect(Object.keys(grouped).sort()).toEqual([...STAGE].sort());
    expect(grouped.novo_lead.map((i) => i.id)).toEqual(["a", "b"]);
    expect(grouped.negociacao.map((i) => i.id)).toEqual(["c"]);
    // Estagio sem item continua existindo, como array vazio.
    expect(grouped.ganho).toEqual([]);
    expect(grouped.perdido).toEqual([]);
  });

  it("retorna todas as colunas vazias quando nao ha itens", () => {
    const grouped = groupByStage([]);
    for (const s of STAGE) expect(grouped[s]).toEqual([]);
  });
});

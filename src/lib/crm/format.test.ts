import { describe, expect, it } from "vitest";
import { formatBRLFromCents, formatPercent, formatPhoneBR, parseBRLToCents } from "./format";

describe("parseBRLToCents", () => {
  it("converte valor com mascara BR para centavos", () => {
    expect(parseBRLToCents("R$ 1.500,00")).toBe(150000);
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("99,90")).toBe(9990);
  });
  it("aceita ponto como decimal quando nao ha virgula", () => {
    expect(parseBRLToCents("1500.50")).toBe(150050);
    expect(parseBRLToCents("1500")).toBe(150000);
  });
  it("retorna null para vazio ou invalido", () => {
    expect(parseBRLToCents("")).toBeNull();
    expect(parseBRLToCents("   ")).toBeNull();
    expect(parseBRLToCents(null)).toBeNull();
    expect(parseBRLToCents("abc")).toBeNull();
  });
});

describe("formatBRLFromCents", () => {
  it("formata centavos em BRL", () => {
    //   = espaco nao separavel usado pelo Intl entre "R$" e o numero.
    expect(formatBRLFromCents(150000)).toBe("R$ 1.500,00");
    expect(formatBRLFromCents(0)).toBe("R$ 0,00");
  });
  it("traco para null/undefined", () => {
    expect(formatBRLFromCents(null)).toBe("-");
    expect(formatBRLFromCents(undefined)).toBe("-");
  });
});

describe("formatPhoneBR", () => {
  it("formata celular normalizado (13 digitos)", () => {
    expect(formatPhoneBR("5511987654321")).toBe("+55 (11) 98765-4321");
  });
  it("formata fixo normalizado (12 digitos)", () => {
    expect(formatPhoneBR("551133334444")).toBe("+55 (11) 3333-4444");
  });
  it("mantem cru se nao bate o formato, traco se vazio", () => {
    expect(formatPhoneBR("123")).toBe("123");
    expect(formatPhoneBR(null)).toBe("-");
  });
});

describe("formatPercent", () => {
  it("formata 0..100", () => {
    expect(formatPercent(70)).toBe("70%");
    expect(formatPercent(0)).toBe("0%");
  });
  it("traco para null", () => {
    expect(formatPercent(null)).toBe("-");
  });
});

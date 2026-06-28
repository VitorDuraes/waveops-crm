// src/lib/crm/url.test.ts — sanitizador de URL externa (anti XSS via javascript:/data:).
import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "./url";

describe("safeExternalUrl", () => {
  it("aceita http e https e preserva a forma do usuario", () => {
    expect(safeExternalUrl("https://waveops.com.br")).toBe("https://waveops.com.br");
    expect(safeExternalUrl("http://exemplo.com/path")).toBe("http://exemplo.com/path");
  });

  it("assume https quando falta o esquema", () => {
    expect(safeExternalUrl("waveops.com.br")).toBe("https://waveops.com.br");
  });

  it("bloqueia esquemas perigosos", () => {
    expect(safeExternalUrl("javascript:alert(document.cookie)")).toBeNull();
    expect(safeExternalUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>1</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("vazio ou nulo vira null", () => {
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl("   ")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });
});

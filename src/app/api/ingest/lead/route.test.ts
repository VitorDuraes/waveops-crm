// src/app/api/ingest/lead/route.test.ts — teste do route handler de ingestao.
// Foco: auth. Sem CRM_INGEST_TOKEN no servidor OU bearer ausente/errado -> 401, antes de tocar o db.
// Nao exige banco: o 401 retorna na camada de auth, antes de chamar ingestLead.
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const ENDPOINT = "http://localhost/api/ingest/lead";

function postJson(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ingest/lead — auth", () => {
  const original = process.env.CRM_INGEST_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.CRM_INGEST_TOKEN;
    else process.env.CRM_INGEST_TOKEN = original;
  });

  it("sem token configurado no servidor -> 401", async () => {
    delete process.env.CRM_INGEST_TOKEN;
    const res = await POST(postJson({ companyName: "X" }, { authorization: "Bearer qualquer" }));
    expect(res.status).toBe(401);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(false);
  });

  it("sem header Authorization -> 401", async () => {
    process.env.CRM_INGEST_TOKEN = "segredo-correto";
    const res = await POST(postJson({ companyName: "X" }));
    expect(res.status).toBe(401);
  });

  it("token errado -> 401", async () => {
    process.env.CRM_INGEST_TOKEN = "segredo-correto";
    const res = await POST(postJson({ companyName: "X" }, { authorization: "Bearer segredo-errado" }));
    expect(res.status).toBe(401);
  });
});

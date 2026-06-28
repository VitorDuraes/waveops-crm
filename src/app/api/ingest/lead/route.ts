// src/app/api/ingest/lead/route.ts — endpoint de INGESTAO de lead externo (WaveOps Prospect).
// POST /api/ingest/lead. Auth por bearer token (CRM_INGEST_TOKEN), comparado em tempo constante.
// Server-only por natureza (route handler nunca vai ao cliente). Runtime nodejs: usa node:crypto.
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingestLead, type IngestLeadInput } from "@/server/ingest";

// node:crypto exige runtime Node (nao Edge). Sem cache: cada lead e uma escrita.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Compara dois segredos em tempo constante. Hash SHA-256 dos dois lados deixa o input
// sempre do mesmo tamanho (timingSafeEqual lanca se os buffers diferem em tamanho) e nao
// vaza o comprimento do token via timing. Retorna false para qualquer entrada nula/vazia.
function safeTokenEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Extrai o token do header Authorization: Bearer <token>. null se ausente/mal formado.
function readBearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

const UNAUTHORIZED = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

// Le um campo opcional de string do body, retornando trim ou null (nunca string vazia).
function readStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Le um campo opcional de inteiro (cents). Aceita number inteiro >= 0; o resto vira null.
function readInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export async function POST(req: Request): Promise<Response> {
  // 1) Auth. Sem token configurado no servidor OU token errado -> 401 (sem vazar qual dos dois).
  const expected = process.env.CRM_INGEST_TOKEN;
  const provided = readBearer(req);
  if (!expected || !provided || !safeTokenEqual(provided, expected)) {
    return UNAUTHORIZED;
  }

  // 2) Parse do body. JSON invalido -> 400.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  // 3) companyName obrigatorio.
  const raw = body as Record<string, unknown>;
  const companyName = readStr(raw.companyName);
  if (!companyName) {
    return NextResponse.json(
      { ok: false, error: "missing_company_name" },
      { status: 400 },
    );
  }

  const input: IngestLeadInput = {
    companyName,
    document: readStr(raw.document),
    phone: readStr(raw.phone),
    segment: readStr(raw.segment),
    origem: readStr(raw.origem),
    website: readStr(raw.website),
    contactName: readStr(raw.contactName),
    opportunityName: readStr(raw.opportunityName),
    planoPretendido: readStr(raw.planoPretendido),
    valorMensalEstimadoCents: readInt(raw.valorMensalEstimadoCents),
  };

  // 4) Orquestracao (db injetado). Falha de dominio -> 422.
  const result = await ingestLead(db, input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json(
    {
      empresaId: result.empresaId,
      oportunidadeId: result.oportunidadeId,
      pessoaId: result.pessoaId,
      dedupedEmpresa: result.dedupedEmpresa,
      dedupedOportunidade: result.dedupedOportunidade,
    },
    { status: 200 },
  );
}

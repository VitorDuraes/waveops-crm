// src/server/empresas.test.ts — testes PUROS do repo de empresas (dedup + normalizacao).
// Usa um fake in-memory de DbOrTx que interpreta o chain Drizzle usado por createEmpresa:
//   select().from().where(eq(col,val)).limit()  |  insert().values().returning()  |  update().set().where(eq(id)).returning()
// Sem banco real: roda em qualquer ambiente (gate sem Docker).
import { describe, expect, it } from "vitest";
import { empresas as empresasTable } from "@/db/schema";
import { createEmpresa, type Empresa } from "./empresas";
import type { DbOrTx } from "./types";

// Mapa nome-da-coluna-no-banco (snake_case) -> chave da propriedade no row (camelCase).
// Ex: "telefone_normalized" -> "telefoneNormalized". O eq() do Drizzle reporta o nome do banco.
const COLUMN_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(empresasTable).map(([key, col]) => [(col as { name?: string }).name ?? key, key]),
);

// Le (chave-da-propriedade, valor) de um eq(col, val) do Drizzle a partir dos queryChunks.
function readEq(condition: unknown): { key: string; value: unknown } | null {
  const chunks = (condition as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return null;
  let columnName: string | undefined;
  let value: unknown;
  for (const c of chunks) {
    const ctor = (c as { constructor?: { name?: string } })?.constructor?.name;
    if (ctor && ctor.startsWith("Pg")) columnName = (c as { name?: string }).name;
    if (ctor === "Param") value = (c as { value?: unknown }).value;
  }
  if (!columnName) return null;
  return { key: COLUMN_TO_KEY[columnName] ?? columnName, value };
}

// Fake minimo de DbOrTx para o caminho de createEmpresa. So implementa o que o repo usa.
function makeFakeDb(): { db: DbOrTx; rows: Empresa[] } {
  const rows: Empresa[] = [];

  function newRow(values: Record<string, unknown>): Empresa {
    const now = new Date();
    return {
      id: `id-${rows.length + 1}`,
      name: "",
      documento: null,
      documentoDisplay: null,
      statusDoCliente: "lead",
      segmento: null,
      origemDoLead: null,
      telefone: null,
      telefoneNormalized: null,
      website: null,
      planoAtual: null,
      valorMensalCents: null,
      formaDePagamento: null,
      proximoVencimento: null,
      ultimoPagamento: null,
      gatewayCustomerId: null,
      createdAt: now,
      updatedAt: now,
      ...values,
    } as Empresa;
  }

  const db = {
    select() {
      return {
        from() {
          return {
            where(condition: unknown) {
              const cond = readEq(condition);
              const matched = cond
                ? rows.filter((r) => (r as Record<string, unknown>)[cond.key] === cond.value)
                : [...rows];
              return {
                limit() {
                  return Promise.resolve(matched.slice(0, 1));
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        values(values: Record<string, unknown>) {
          return {
            returning() {
              const row = newRow(values);
              rows.push(row);
              return Promise.resolve([row]);
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          return {
            where(condition: unknown) {
              const cond = readEq(condition);
              return {
                returning() {
                  const idx = cond
                    ? rows.findIndex((r) => (r as Record<string, unknown>)[cond.key] === cond.value)
                    : -1;
                  if (idx < 0) return Promise.resolve([]);
                  rows[idx] = { ...rows[idx], ...values } as Empresa;
                  return Promise.resolve([rows[idx]]);
                },
              };
            },
          };
        },
      };
    },
  } as unknown as DbOrTx;

  return { db, rows };
}

// Sanidade: garante que o nome real da coluna documento bate com o que o fake espera.
describe("schema", () => {
  it("coluna documento existe na tabela empresas", () => {
    expect(empresasTable.documento.name).toBe("documento");
  });
});

describe("createEmpresa — happy path", () => {
  it("cria empresa nova normalizando documento e telefone", async () => {
    const { db, rows } = makeFakeDb();
    const result = await createEmpresa(db, {
      name: "  Studio Bella  ",
      documento: "12.345.678/0001-99",
      telefone: "(11) 98765-4321",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deduped).toBe(false);
    expect(rows).toHaveLength(1);
    expect(result.empresa.name).toBe("Studio Bella");
    expect(result.empresa.documento).toBe("12345678000199"); // so digitos
    expect(result.empresa.documentoDisplay).toBe("12.345.678/0001-99");
    expect(result.empresa.telefoneNormalized).toBe("5511987654321"); // DDI 55 prefixado
    expect(result.empresa.statusDoCliente).toBe("lead"); // default
  });
});

describe("createEmpresa — dedup", () => {
  it("mesmo documento: ATUALIZA em vez de duplicar", async () => {
    const { db, rows } = makeFakeDb();
    const first = await createEmpresa(db, { name: "Empresa A", documento: "123.456.789-00" });
    expect(first.ok).toBe(true);

    const second = await createEmpresa(db, {
      name: "Empresa A (atualizada)",
      documento: "12345678900", // mesmo documento, mascara diferente
      website: "https://a.com",
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.deduped).toBe(true);
    expect(rows).toHaveLength(1); // nao duplicou
    expect(rows[0].name).toBe("Empresa A (atualizada)");
    expect(rows[0].website).toBe("https://a.com");
  });

  it("mesmo telefone (mascaras diferentes): ATUALIZA em vez de duplicar", async () => {
    const { db, rows } = makeFakeDb();
    await createEmpresa(db, { name: "Loja X", telefone: "11987654321" });
    const dup = await createEmpresa(db, { name: "Loja X 2", telefone: "(11) 98765-4321" });

    expect(dup.ok).toBe(true);
    if (!dup.ok) return;
    expect(dup.deduped).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Loja X 2");
  });

  it("documento/telefone diferentes: cria registros separados", async () => {
    const { db, rows } = makeFakeDb();
    await createEmpresa(db, { name: "A", documento: "111", telefone: "11999990000" });
    await createEmpresa(db, { name: "B", documento: "222", telefone: "11888880000" });
    expect(rows).toHaveLength(2);
  });
});

describe("createEmpresa — erros", () => {
  it("nome vazio -> missing_fields", async () => {
    const { db } = makeFakeDb();
    const result = await createEmpresa(db, { name: "   " });
    expect(result).toEqual({ ok: false, error: "missing_fields" });
  });

  it("segmento invalido -> invalid_segmento", async () => {
    const { db } = makeFakeDb();
    const result = await createEmpresa(db, { name: "X", segmento: "nao_existe" });
    expect(result).toEqual({ ok: false, error: "invalid_segmento" });
  });

  it("status invalido -> invalid_status", async () => {
    const { db } = makeFakeDb();
    const result = await createEmpresa(db, { name: "X", statusDoCliente: "nao_existe" });
    expect(result).toEqual({ ok: false, error: "invalid_status" });
  });
});

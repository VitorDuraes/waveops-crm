// src/server/ingest.test.ts — testes PUROS da orquestracao de ingestao (sem banco real).
// Fake in-memory de DbOrTx, table-aware, que interpreta o chain Drizzle usado pelos repos:
//   select(...).from(tabela).where(cond).limit()     | leitura (eq, notInArray, and)
//   insert(tabela).values(v).returning()             | escrita
//   update(tabela).set(v).where(eq(id)).returning()  | dedup da empresa
// Cobre: cria empresa+oportunidade; reenvio nao duplica; mapeamento de segment; sem contactName.
import { describe, expect, it } from "vitest";
import { empresas, oportunidades, pessoas } from "@/db/schema";
import { ingestLead } from "./ingest";
import type { DbOrTx } from "./types";

// Mapa nome-de-coluna-no-banco (snake_case) -> chave camelCase do row, por tabela.
function keyMap(table: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(table)
      .filter(([, col]) => col && typeof col === "object" && "name" in (col as object))
      .map(([key, col]) => [(col as { name?: string }).name ?? key, key]),
  );
}

const KEYS = {
  empresas: keyMap(empresas as unknown as Record<string, unknown>),
  pessoas: keyMap(pessoas as unknown as Record<string, unknown>),
  oportunidades: keyMap(oportunidades as unknown as Record<string, unknown>),
};

type Row = Record<string, unknown>;

// Avalia uma condicao Drizzle (SQL) contra um row. Suporta eq, notInArray e and.
function matches(condition: unknown, row: Row, keys: Record<string, string>): boolean {
  const chunks = (condition as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return true;

  // and(...) -> chunks contem SQL aninhados; todos precisam casar.
  const nested = chunks.filter(
    (c) => (c as { constructor?: { name?: string } })?.constructor?.name === "SQL",
  );
  if (nested.length > 0) {
    return nested.every((n) => matches(n, row, keys));
  }

  // Condicao folha: pega a coluna, o(s) Param e detecta se ha um Array (notInArray).
  let columnName: string | undefined;
  const params: unknown[] = [];
  let arrayValues: unknown[] | null = null;

  for (const c of chunks) {
    const ctor = (c as { constructor?: { name?: string } })?.constructor?.name;
    if (ctor && ctor.startsWith("Pg")) columnName = (c as { name?: string }).name;
    else if (ctor === "Param") params.push((c as { value?: unknown }).value);
    else if (Array.isArray(c)) {
      arrayValues = (c as unknown[]).map((el) => (el as { value?: unknown }).value);
    }
  }
  if (!columnName) return true;
  const key = keys[columnName] ?? columnName;
  const cell = row[key];

  if (arrayValues) return !arrayValues.includes(cell); // notInArray
  return cell === params[0]; // eq
}

// Defaults por tabela (colunas com default no schema que o repo nao informa no insert).
function withDefaults(table: string, values: Row, id: string): Row {
  const base: Row = { id, createdAt: new Date(), updatedAt: new Date() };
  if (table === "empresas") {
    return { documento: null, telefoneNormalized: null, statusDoCliente: "lead", ...base, ...values };
  }
  if (table === "oportunidades") {
    return { stage: "novo_lead", pessoaId: null, ...base, ...values };
  }
  return { ...base, ...values };
}

function tableNameOf(table: unknown): "empresas" | "pessoas" | "oportunidades" {
  if (table === empresas) return "empresas";
  if (table === pessoas) return "pessoas";
  if (table === oportunidades) return "oportunidades";
  throw new Error("tabela desconhecida no fake");
}

function makeFakeDb() {
  const store: Record<string, Row[]> = { empresas: [], pessoas: [], oportunidades: [] };
  let seq = 0;

  const db = {
    select() {
      return {
        from(table: unknown) {
          const name = tableNameOf(table);
          return {
            where(condition: unknown) {
              const rows = store[name].filter((r) => matches(condition, r, KEYS[name]));
              return {
                limit() {
                  return Promise.resolve(rows.slice(0, 1));
                },
              };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      const name = tableNameOf(table);
      return {
        values(values: Row) {
          return {
            returning() {
              const row = withDefaults(name, values, `${name}-${++seq}`);
              store[name].push(row);
              return Promise.resolve([row]);
            },
          };
        },
      };
    },
    update(table: unknown) {
      const name = tableNameOf(table);
      return {
        set(values: Row) {
          return {
            where(condition: unknown) {
              return {
                returning() {
                  const idx = store[name].findIndex((r) => matches(condition, r, KEYS[name]));
                  if (idx < 0) return Promise.resolve([]);
                  store[name][idx] = { ...store[name][idx], ...values };
                  return Promise.resolve([store[name][idx]]);
                },
              };
            },
          };
        },
      };
    },
  } as unknown as DbOrTx;

  return { db, store };
}

describe("ingestLead — happy path", () => {
  it("cria empresa (lead) + oportunidade (novo_lead) sem contato", async () => {
    const { db, store } = makeFakeDb();
    const result = await ingestLead(db, {
      companyName: "  Studio Bella  ",
      document: "12.345.678/0001-99",
      phone: "(11) 98765-4321",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dedupedEmpresa).toBe(false);
    expect(result.dedupedOportunidade).toBe(false);
    expect(result.pessoaId).toBeNull();
    expect(store.empresas).toHaveLength(1);
    expect(store.oportunidades).toHaveLength(1);
    expect(store.pessoas).toHaveLength(0);

    const empresa = store.empresas[0];
    expect(empresa.name).toBe("Studio Bella");
    expect(empresa.statusDoCliente).toBe("lead");
    expect(empresa.origemDoLead).toBe("outbound"); // default de lead prospectado
    expect(empresa.documento).toBe("12345678000199"); // normalizado
    expect(empresa.telefoneNormalized).toBe("5511987654321");

    const op = store.oportunidades[0];
    expect(op.name).toBe("Studio Bella"); // sem opportunityName -> companyName
    expect(op.stage).toBe("novo_lead");
    expect(op.empresaId).toBe(empresa.id);
  });

  it("usa opportunityName, plano e valor quando informados", async () => {
    const { db, store } = makeFakeDb();
    const result = await ingestLead(db, {
      companyName: "Loja X",
      opportunityName: "Loja X — Plano Pro",
      planoPretendido: "pro",
      valorMensalEstimadoCents: 49900,
      origem: "indicacao",
    });
    expect(result.ok).toBe(true);
    const op = store.oportunidades[0];
    expect(op.name).toBe("Loja X — Plano Pro");
    expect(op.planoPretendido).toBe("pro");
    expect(op.valorMensalEstimadoCents).toBe(49900);
    expect(store.empresas[0].origemDoLead).toBe("indicacao"); // origem recebida vence o default
  });
});

describe("ingestLead — contato", () => {
  it("com contactName cria pessoa ligada a empresa (first/last split)", async () => {
    const { db, store } = makeFakeDb();
    const result = await ingestLead(db, {
      companyName: "Empresa Z",
      contactName: "Maria Silva Souza",
      phone: "11999990000",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.pessoas).toHaveLength(1);
    expect(result.pessoaId).toBe(store.pessoas[0].id);
    expect(store.pessoas[0].firstName).toBe("Maria");
    expect(store.pessoas[0].lastName).toBe("Silva Souza");
    expect(store.pessoas[0].empresaId).toBe(store.empresas[0].id);
  });

  it("sem contactName NAO cria pessoa", async () => {
    const { db, store } = makeFakeDb();
    await ingestLead(db, { companyName: "Sem Contato" });
    expect(store.pessoas).toHaveLength(0);
  });
});

describe("ingestLead — idempotencia (reenvio)", () => {
  it("mesmo documento: nao duplica empresa nem oportunidade", async () => {
    const { db, store } = makeFakeDb();
    const first = await ingestLead(db, { companyName: "ACME", document: "111.222.333-44" });
    expect(first.ok).toBe(true);

    const second = await ingestLead(db, {
      companyName: "ACME",
      document: "11122233344", // mesmo documento, mascara diferente
    });
    expect(second.ok).toBe(true);
    if (!second.ok || !first.ok) return;

    expect(store.empresas).toHaveLength(1); // dedup da empresa
    expect(store.oportunidades).toHaveLength(1); // oportunidade aberta reusada
    expect(second.dedupedEmpresa).toBe(true);
    expect(second.dedupedOportunidade).toBe(true);
    expect(second.empresaId).toBe(first.empresaId);
    expect(second.oportunidadeId).toBe(first.oportunidadeId);
  });

  it("empresa com oportunidade FECHADA (perdido) gera nova oportunidade", async () => {
    const { db, store } = makeFakeDb();
    const first = await ingestLead(db, { companyName: "Reativa", phone: "11988887777" });
    expect(first.ok).toBe(true);

    // Simula a oportunidade existente como perdida (fechada): nao deve mais bloquear.
    store.oportunidades[0].stage = "perdido";

    const second = await ingestLead(db, { companyName: "Reativa", phone: "11988887777" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(store.empresas).toHaveLength(1); // mesma empresa (dedup por telefone)
    expect(store.oportunidades).toHaveLength(2); // nova oportunidade aberta
    expect(second.dedupedOportunidade).toBe(false);
  });
});

describe("ingestLead — mapeamento de segment", () => {
  it("texto livre casa por palavra-chave (acento/caixa)", async () => {
    const { db, store } = makeFakeDb();
    await ingestLead(db, { companyName: "Clinica A", segment: "Clínica Odontológica" });
    expect(store.empresas[0].segmento).toBe("clinica_saude");
  });

  it("value exato do enum e mantido", async () => {
    const { db, store } = makeFakeDb();
    await ingestLead(db, { companyName: "Loja B", segment: "ecommerce" });
    expect(store.empresas[0].segmento).toBe("ecommerce");
  });

  it("texto desconhecido cai em 'outro'", async () => {
    const { db, store } = makeFakeDb();
    await ingestLead(db, { companyName: "X", segment: "ramo qualquer inexistente" });
    expect(store.empresas[0].segmento).toBe("outro");
  });

  it("segment ausente deixa segmento null", async () => {
    const { db, store } = makeFakeDb();
    await ingestLead(db, { companyName: "Y" });
    expect(store.empresas[0].segmento).toBeNull();
  });
});

describe("ingestLead — validacao", () => {
  it("companyName vazio -> missing_company_name", async () => {
    const { db } = makeFakeDb();
    const result = await ingestLead(db, { companyName: "   " });
    expect(result).toEqual({ ok: false, error: "missing_company_name" });
  });
});

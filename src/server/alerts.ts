// src/server/alerts.ts — busca as linhas e delega a computeAlerts puro de @/lib/crm/alerts.
import { assinaturas, empresas, faturas, oportunidades } from "@/db/schema";
import { computeAlerts, type Alerta } from "@/lib/crm/alerts";
import type { DbOrTx } from "./types";

export async function getAlertas(db: DbOrTx, now: Date = new Date()): Promise<Alerta[]> {
  const [ftRows, assRows, opsRows, empRows] = await Promise.all([
    db
      .select({
        id: faturas.id,
        status: faturas.status,
        vencimento: faturas.vencimento,
        empresaId: faturas.empresaId,
      })
      .from(faturas),
    db
      .select({
        id: assinaturas.id,
        status: assinaturas.status,
        proximoVencimento: assinaturas.proximoVencimento,
        empresaId: assinaturas.empresaId,
      })
      .from(assinaturas),
    db
      .select({
        id: oportunidades.id,
        name: oportunidades.name,
        stage: oportunidades.stage,
        updatedAt: oportunidades.updatedAt,
        empresaId: oportunidades.empresaId,
      })
      .from(oportunidades),
    db.select({ id: empresas.id, name: empresas.name }).from(empresas),
  ]);

  const empresaNames: Record<string, string> = {};
  for (const e of empRows) empresaNames[e.id] = e.name;

  return computeAlerts({
    faturas: ftRows,
    assinaturas: assRows,
    oportunidades: opsRows,
    empresaNames,
    now,
  });
}

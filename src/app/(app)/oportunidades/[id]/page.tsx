// src/app/(app)/oportunidades/[id]/page.tsx - record page da Oportunidade (Server Component).
// Busca o deal, diagnosticos, propostas, notas, tasks e historico em paralelo. notFound se sumir.
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { getOportunidadeById } from "@/server/oportunidades";
import { listDiagnosticosByOportunidade } from "@/server/diagnosticos";
import { listPropostasByOportunidade } from "@/server/propostas";
import { getEmpresaById } from "@/server/empresas";
import { listNotesByTarget } from "@/server/notes";
import { listTasksByTarget } from "@/server/tasks";
import { listAuditByTarget, getActorNames } from "@/server/audit";
import {
  FIT_LABELS,
  PLANO_LABELS,
  STAGE_LABELS,
  STATUS_PROPOSTA_LABELS,
} from "@/lib/crm/labels";
import { formatBRLFromCents, formatPercent } from "@/lib/crm/format";
import type { Fit, Plano, StatusProposta } from "@/lib/validators";
import { Timeline } from "@/components/atividades/timeline";
import { NoteForm } from "@/components/atividades/note-form";
import { NotesList } from "@/components/atividades/notes-list";
import { TaskForm } from "@/components/atividades/task-form";
import { TaskList } from "@/components/atividades/task-list";
import { DiagnosticoForm } from "@/components/oportunidades/diagnostico-form";
import { PropostaQuickCreate } from "@/components/oportunidades/proposta-quick-create";

export const dynamic = "force-dynamic";

const TARGET = "oportunidade";

// Date -> "23/06/2026". null -> traco. Pura, sem PII.
function formatDate(value: Date | null | undefined): string {
  if (!value) return "-";
  return value.toLocaleDateString("pt-BR");
}

export default async function OportunidadePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [oportunidade, diagnosticos, propostas, notes, tasks, eventos] = await Promise.all([
    getOportunidadeById(db, id),
    listDiagnosticosByOportunidade(db, id),
    listPropostasByOportunidade(db, id),
    listNotesByTarget(db, TARGET, id),
    listTasksByTarget(db, TARGET, id),
    listAuditByTarget(db, TARGET, id),
  ]);

  if (!oportunidade) notFound();

  const [empresa, actorNames] = await Promise.all([
    getEmpresaById(db, oportunidade.empresaId),
    getActorNames(
      db,
      eventos.map((e) => e.actorId),
    ),
  ]);

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold text-neutral-900">{oportunidade.name}</h2>
          <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
            {STAGE_LABELS[oportunidade.stage as keyof typeof STAGE_LABELS]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-neutral-600">
          <span>
            Empresa:{" "}
            <Link
              href={`/empresas/${oportunidade.empresaId}`}
              className="font-medium text-[var(--color-brand)] hover:underline"
            >
              {empresa?.name ?? "-"}
            </Link>
          </span>
          <span>
            Valor mensal:{" "}
            <span className="font-medium text-neutral-800">
              {formatBRLFromCents(oportunidade.valorMensalEstimadoCents)}
            </span>
          </span>
          <span>
            Probabilidade:{" "}
            <span className="font-medium text-neutral-800">
              {formatPercent(oportunidade.probabilidade)}
            </span>
          </span>
        </div>
      </header>

      {/* Diagnostico */}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-neutral-900">Diagnóstico</h3>
        {diagnosticos.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum diagnóstico registrado.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {diagnosticos.map((d) => (
              <li key={d.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">{formatDate(d.createdAt)}</span>
                  {d.fit ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      Fit: {FIT_LABELS[d.fit as Fit]}
                    </span>
                  ) : null}
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {d.dor ? (
                    <Campo termo="Dor" valor={d.dor} />
                  ) : null}
                  {d.processoAtual ? (
                    <Campo termo="Processo atual" valor={d.processoAtual} />
                  ) : null}
                  {d.ferramentas ? (
                    <Campo termo="Ferramentas" valor={d.ferramentas} />
                  ) : null}
                  {d.volume ? <Campo termo="Volume" valor={d.volume} /> : null}
                </dl>
              </li>
            ))}
          </ul>
        )}
        <DiagnosticoForm oportunidadeId={oportunidade.id} />
      </section>

      {/* Propostas */}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-neutral-900">Propostas</h3>
        {propostas.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma proposta registrada.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {propostas.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium text-neutral-900">{p.name}</span>
                  <span className="text-xs text-neutral-500">
                    {p.plano ? PLANO_LABELS[p.plano as Plano] : "Sem plano"} · Validade{" "}
                    {formatDate(p.validade)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-800">
                    {formatBRLFromCents(p.valorMensalCents)}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                    {STATUS_PROPOSTA_LABELS[p.status as StatusProposta]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <PropostaQuickCreate oportunidadeId={oportunidade.id} />
      </section>

      {/* Atividades */}
      <section className="flex flex-col gap-6">
        <h3 className="text-lg font-semibold text-neutral-900">Atividades</h3>

        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-neutral-700">Notas</h4>
          <NoteForm targetType={TARGET} targetId={oportunidade.id} />
          <NotesList notes={notes} />
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-neutral-700">Tarefas</h4>
          <TaskForm targetType={TARGET} targetId={oportunidade.id} />
          <TaskList tasks={tasks} targetType={TARGET} targetId={oportunidade.id} />
        </div>
      </section>

      {/* Historico */}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-neutral-900">Histórico</h3>
        <Timeline events={eventos} actorNames={actorNames} />
      </section>
    </div>
  );
}

function Campo({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-neutral-500">{termo}</dt>
      <dd className="text-neutral-800">{valor}</dd>
    </div>
  );
}

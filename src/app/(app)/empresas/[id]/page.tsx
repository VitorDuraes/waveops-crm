// src/app/(app)/empresas/[id]/page.tsx - record page da Empresa (Server Component).
// Busca tudo em paralelo em runtime (force-dynamic). notFound() se a empresa nao existir.
// Renderiza header + Pessoas, Oportunidades, Propostas, Atividades e Historico (timeline).
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatBRLFromCents, formatPhoneBR } from "@/lib/crm/format";
import { safeExternalUrl } from "@/lib/crm/url";
import {
  ORIGEM_LABELS,
  PRIORIDADE_CHAMADO_LABELS,
  SEGMENTO_LABELS,
  STAGE_LABELS,
  STATUS_CHAMADO_LABELS,
  STATUS_PROPOSTA_LABELS,
} from "@/lib/crm/labels";
import { StatusClienteBadge } from "@/components/ui/badge";
import { PessoaCreateForm } from "@/components/empresas/pessoa-create-form";
import { BriefingForm } from "@/components/empresas/briefing-form";
import { NoteForm } from "@/components/atividades/note-form";
import { NotesList } from "@/components/atividades/notes-list";
import { TaskForm } from "@/components/atividades/task-form";
import { TaskList } from "@/components/atividades/task-list";
import { Timeline } from "@/components/atividades/timeline";
import { getActorNames, listAuditByTarget } from "@/server/audit";
import { getBriefingByEmpresa } from "@/server/briefings";
import { listChamadosByEmpresa } from "@/server/chamados";
import { getEmpresaById } from "@/server/empresas";
import { listNotesByTarget } from "@/server/notes";
import { listOportunidadesByEmpresa } from "@/server/oportunidades";
import { listPessoasByEmpresa } from "@/server/pessoas";
import { listPropostasByEmpresa } from "@/server/propostas";
import { listTasksByTarget } from "@/server/tasks";
import type {
  Origem,
  PrioridadeChamado,
  Segmento,
  Stage,
  StatusChamado,
  StatusCliente,
  StatusProposta,
} from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function EmpresaRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const empresa = await getEmpresaById(db, id);
  if (!empresa) notFound();

  const [pessoas, oportunidades, propostas, chamados, briefing, notes, tasks, audit] =
    await Promise.all([
      listPessoasByEmpresa(db, id),
      listOportunidadesByEmpresa(db, id),
      listPropostasByEmpresa(db, id),
      listChamadosByEmpresa(db, id),
      getBriefingByEmpresa(db, id),
      listNotesByTarget(db, "empresa", id),
      listTasksByTarget(db, "empresa", id),
      listAuditByTarget(db, "empresa", id),
    ]);

  const actorNames = await getActorNames(
    db,
    audit.map((e) => e.actorId),
  );

  const segmentoLabel =
    empresa.segmento && empresa.segmento in SEGMENTO_LABELS
      ? SEGMENTO_LABELS[empresa.segmento as Segmento]
      : null;
  const origemLabel =
    empresa.origemDoLead && empresa.origemDoLead in ORIGEM_LABELS
      ? ORIGEM_LABELS[empresa.origemDoLead as Origem]
      : null;

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold text-neutral-900">{empresa.name}</h2>
          <StatusClienteBadge status={empresa.statusDoCliente as StatusCliente} />
        </div>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Segmento" value={segmentoLabel} />
          <Info label="Origem" value={origemLabel} />
          <Info label="Telefone" value={formatPhoneBR(empresa.telefoneNormalized)} />
          <Info label="Documento" value={empresa.documentoDisplay} />
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Website</dt>
            <dd className="text-neutral-700">
              {(() => {
                const site = safeExternalUrl(empresa.website);
                return site ? (
                  <a
                    href={site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-brand)] hover:underline"
                  >
                    {site.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  "-"
                );
              })()}
            </dd>
          </div>
        </dl>
      </header>

      {/* Pessoas */}
      <Section title="Pessoas" count={pessoas.length}>
        {pessoas.length === 0 ? (
          <EmptyHint>Nenhum contato cadastrado.</EmptyHint>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {pessoas.map((p) => {
              const nome = [p.firstName, p.lastName].filter(Boolean).join(" ");
              return (
                <li key={p.id} className="flex flex-col gap-0.5 px-4 py-3">
                  <span className="font-medium text-neutral-900">{nome}</span>
                  <span className="text-sm text-neutral-500">
                    {p.email ?? "-"} · {formatPhoneBR(p.phoneNormalized)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3">
          <PessoaCreateForm empresaId={id} />
        </div>
      </Section>

      {/* Oportunidades */}
      <Section title="Oportunidades" count={oportunidades.length}>
        {oportunidades.length === 0 ? (
          <EmptyHint>Nenhuma oportunidade nesta empresa.</EmptyHint>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {oportunidades.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/oportunidades/${o.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-neutral-900">{o.name}</span>
                    <span className="text-sm text-neutral-500">
                      {formatBRLFromCents(o.valorMensalEstimadoCents)} por mês
                    </span>
                  </div>
                  <span className="inline-flex flex-none items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                    {STAGE_LABELS[o.stage as Stage] ?? o.stage}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Propostas */}
      <Section title="Propostas" count={propostas.length}>
        {propostas.length === 0 ? (
          <EmptyHint>Nenhuma proposta nesta empresa.</EmptyHint>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {propostas.map((pr) => (
              <li key={pr.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-neutral-900">{pr.name}</span>
                  <span className="text-sm text-neutral-500">
                    {formatBRLFromCents(pr.valorMensalCents)} por mês
                  </span>
                </div>
                <span className="inline-flex flex-none items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                  {STATUS_PROPOSTA_LABELS[pr.status as StatusProposta] ?? pr.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Atividades */}
      <Section title="Atividades">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-neutral-700">Notas</h4>
            <NoteForm targetType="empresa" targetId={id} />
            <NotesList notes={notes} />
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-neutral-700">Tarefas</h4>
            <TaskForm targetType="empresa" targetId={id} />
            <TaskList tasks={tasks} targetType="empresa" targetId={id} />
          </div>
        </div>
      </Section>

      {/* Suporte */}
      <Section title="Suporte" count={chamados.length}>
        {chamados.length === 0 ? (
          <EmptyHint>Nenhum chamado desta empresa.</EmptyHint>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {chamados.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-neutral-900">{c.titulo}</span>
                  <span className="text-sm text-neutral-500">
                    {PRIORIDADE_CHAMADO_LABELS[c.prioridade as PrioridadeChamado] ?? c.prioridade}
                  </span>
                </div>
                <span className="inline-flex flex-none items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                  {STATUS_CHAMADO_LABELS[c.status as StatusChamado] ?? c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          Abra e gerencie chamados em{" "}
          <Link href="/chamados" className="text-[var(--color-brand)] hover:underline">
            Chamados
          </Link>
          .
        </p>
      </Section>

      {/* Briefing */}
      <Section title="Briefing">
        <BriefingForm
          empresaId={id}
          briefing={
            briefing
              ? {
                  objetivo: briefing.objetivo,
                  ferramentaAtual: briefing.ferramentaAtual,
                  dor: briefing.dor,
                  volume: briefing.volume,
                }
              : null
          }
        />
      </Section>

      {/* Historico */}
      <Section title="Histórico">
        <Timeline events={audit} actorNames={actorNames} />
      </Section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-neutral-700">{value ?? "-"}</dd>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-neutral-900">
        {title}
        {count !== undefined ? (
          <span className="ml-2 text-sm font-normal text-neutral-400">{count}</span>
        ) : null}
      </h3>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
      {children}
    </p>
  );
}

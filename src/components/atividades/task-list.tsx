"use client";
// src/components/atividades/task-list.tsx — lista de tarefas de um registro com badge de status.
// Tarefa aberta/em andamento mostra botao Concluir, que chama updateTaskStatusAction e refresh.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TASK_STATUS_LABELS } from "@/lib/crm/labels";
import type { TaskStatus } from "@/lib/validators";
import type { Task } from "@/server/tasks";
import { updateTaskStatusAction } from "@/server/actions/atividades.actions";

function statusLabel(status: string): string {
  return TASK_STATUS_LABELS[status as TaskStatus] ?? status;
}

function formatDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function TaskList({
  tasks,
  targetType,
  targetId,
}: {
  tasks: Task[];
  targetType: string;
  targetId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function concluir(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await updateTaskStatusAction(id, "concluida", targetType, targetId);
      if (!result.ok) {
        setError("Não foi possível concluir a tarefa. Tente novamente.");
      }
      setPendingId(null);
      router.refresh();
    });
  }

  if (tasks.length === 0) {
    return <p className="text-sm text-neutral-400">Nenhuma tarefa ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {tasks.map((task) => {
          const venc = formatDate(task.dueAt);
          const concluida = task.status === "concluida";
          return (
            <li
              key={task.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3"
            >
              <div className="flex min-w-0 flex-col">
                <p
                  className={`text-sm font-medium ${
                    concluida ? "text-neutral-400 line-through" : "text-neutral-900"
                  }`}
                >
                  {task.title}
                </p>
                {venc ? <p className="mt-0.5 text-xs text-neutral-500">Vence em {venc}</p> : null}
              </div>

              <div className="flex flex-none items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                  {statusLabel(task.status)}
                </span>
                {!concluida ? (
                  <button
                    type="button"
                    onClick={() => concluir(task.id)}
                    disabled={isPending && pendingId === task.id}
                    className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending && pendingId === task.id ? "Concluindo..." : "Concluir"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

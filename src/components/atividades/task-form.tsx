"use client";
// src/components/atividades/task-form.tsx — cria uma tarefa para um registro (targetType, targetId).
// Padrao do projeto: useTransition + chamada direta da action. Em sucesso limpa o form e refresh.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction } from "@/server/actions/atividades.actions";

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-violet-100";

export function TaskForm({ targetType, targetId }: { targetType: string; targetId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createTaskAction(null, formData);
      if (result?.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result?.message ?? "Não foi possível criar a tarefa.");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Tarefa *
          <input name="title" type="text" required placeholder="Ex: Ligar para o cliente" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Vencimento
          <input name="dueAt" type="date" className={inputCls} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="w-fit rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Criar tarefa"}
        </button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </form>
  );
}

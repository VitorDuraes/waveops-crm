"use client";
// src/components/atividades/note-form.tsx — adiciona uma nota a um registro (targetType, targetId).
// Padrao do projeto: useTransition + chamada direta da action. Em sucesso limpa o campo e refresh.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNoteAction } from "@/server/actions/atividades.actions";

export function NoteForm({ targetType, targetId }: { targetType: string; targetId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createNoteAction(null, formData);
      if (result?.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result?.message ?? "Não foi possível adicionar a nota.");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <textarea
        name="body"
        required
        rows={3}
        placeholder="Escreva uma nota..."
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-violet-100"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="w-fit rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Adicionar nota"}
        </button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </form>
  );
}

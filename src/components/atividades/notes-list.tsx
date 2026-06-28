// src/components/atividades/notes-list.tsx - lista de notas de um registro (body + data).
// Server Component puro: so recebe as notas ja buscadas pelo repo no Server Component pai.
import type { Note } from "@/server/notes";

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function NotesList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return <p className="text-sm text-neutral-400">Nenhuma nota ainda.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="whitespace-pre-wrap text-sm text-neutral-900">{note.body}</p>
          <p className="mt-1.5 text-xs text-neutral-500">{formatDateTime(note.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}

// src/app/(app)/buscar/page.tsx — busca global (Server Component). Form GET, sem client.
// Le a query de searchParams (Promise no Next 16). Renderiza 3 grupos: empresas, pessoas,
// oportunidades. Estado vazio amigavel quando nao ha query ou nao ha resultado.
import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { searchAll } from "@/server/search";

export const dynamic = "force-dynamic";

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";

  const resultado = q.trim() ? await searchAll(db, q) : null;
  const total = resultado
    ? resultado.empresas.length + resultado.pessoas.length + resultado.oportunidades.length
    : 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Buscar</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Procure por empresas, pessoas e oportunidades.
          </p>
        </div>
        <form method="get" className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nome, e-mail, documento ou telefone"
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[var(--color-brand)] sm:max-w-md"
          />
          <button
            type="submit"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--color-brand)" }}
          >
            Buscar
          </button>
        </form>
      </header>

      {!q.trim() ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Digite um termo acima para buscar empresas, pessoas e oportunidades.
        </p>
      ) : total === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          Nenhum resultado para {`"${q.trim()}"`}. Tente outro termo.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          <SearchGroup
            titulo="Empresas"
            count={resultado!.empresas.length}
            vazio="Nenhuma empresa encontrada."
          >
            {resultado!.empresas.map((empresa) => (
              <li key={empresa.id}>
                <Link
                  href={`/empresas/${empresa.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-neutral-50"
                >
                  <span className="font-medium text-neutral-900">{empresa.name}</span>
                </Link>
              </li>
            ))}
          </SearchGroup>

          <SearchGroup
            titulo="Pessoas"
            count={resultado!.pessoas.length}
            vazio="Nenhuma pessoa encontrada."
          >
            {resultado!.pessoas.map((pessoa) => {
              const nome = [pessoa.firstName, pessoa.lastName].filter(Boolean).join(" ");
              return (
                <li key={pessoa.id} className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-neutral-900">{nome}</span>
                    {pessoa.empresaId ? (
                      <Link
                        href={`/empresas/${pessoa.empresaId}`}
                        className="mt-0.5 w-fit text-xs text-[var(--color-brand)] hover:underline"
                      >
                        Ver empresa
                      </Link>
                    ) : (
                      <span className="mt-0.5 text-xs text-neutral-400">Sem empresa</span>
                    )}
                  </div>
                </li>
              );
            })}
          </SearchGroup>

          <SearchGroup
            titulo="Oportunidades"
            count={resultado!.oportunidades.length}
            vazio="Nenhuma oportunidade encontrada."
          >
            {resultado!.oportunidades.map((oportunidade) => (
              <li key={oportunidade.id}>
                <Link
                  href={`/oportunidades/${oportunidade.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-neutral-50"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-neutral-900">{oportunidade.name}</span>
                    <span className="mt-0.5 text-xs text-neutral-500">
                      {oportunidade.empresaName}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </SearchGroup>
        </div>
      )}
    </div>
  );
}

// Cartao de um grupo de resultado. Renderiza o titulo com contagem e a lista (ou estado vazio).
function SearchGroup({
  titulo,
  count,
  vazio,
  children,
}: {
  titulo: string;
  count: number;
  vazio: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {titulo} ({count})
      </h3>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-400">
          {vazio}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {children}
        </ul>
      )}
    </section>
  );
}

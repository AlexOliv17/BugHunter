import type { Metadata } from "next";
import Link from "next/link";

import { exigirUsuario } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { montarCards, type CardTema, type ProgressoTema, type TemaPublico } from "@/lib/temas";

export const metadata: Metadata = { title: "Temas · BugHunter" };

function CardAtivo({ tema }: { tema: CardTema }) {
  return (
    <Link href={`/temas/${tema.codigo}`}
      className="group flex min-h-56 flex-col justify-between rounded border border-destaque bg-painel p-8 transition-colors hover:bg-campo">
      <div>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-semibold">{tema.nome}</h2>
          <span aria-hidden className="text-2xl text-destaque transition-transform group-hover:translate-x-1">→</span>
        </div>
        <p className="mt-3 text-texto-secundario">{tema.descricao}</p>
      </div>
      <div>
        <div className="flex justify-between text-sm">
          <span className="text-texto-secundario">{tema.resolvidos} de {tema.total} exercícios</span>
          <span className="font-semibold text-destaque">{tema.porcentagem}%</span>
        </div>
        <div className="mt-3 h-1 rounded bg-borda" role="progressbar" aria-label={`Progresso em ${tema.nome}`}
          aria-valuemin={0} aria-valuemax={tema.total} aria-valuenow={tema.resolvidos}>
          <div className="h-1 rounded bg-destaque" style={{ width: `${tema.porcentagem}%` }} />
        </div>
      </div>
    </Link>
  );
}

function CardIndisponivel({ tema }: { tema: CardTema }) {
  return (
    <div aria-disabled className="flex min-h-56 flex-col justify-between rounded border border-borda p-8 text-texto-apagado">
      <div>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-semibold">{tema.nome}</h2>
          <span className="rounded border border-borda px-2 py-1 text-xs font-semibold">V2</span>
        </div>
        <p className="mt-3">{tema.descricao}</p>
      </div>
      <p className="text-sm">Banco de exercícios em construção</p>
    </div>
  );
}

export default async function PaginaTemas() {
  await exigirUsuario("/temas");
  const supabase = await criarClienteServidor();
  const [temas, progresso] = await Promise.all([
    supabase.from("temas_publicos").select("codigo, nome, descricao, ativo, ordem").order("ordem"),
    supabase.rpc("progresso_por_tema"),
  ]);
  if (temas.error || progresso.error) throw new Error("Não foi possível carregar os temas.");
  const cards = montarCards(temas.data as TemaPublico[], progresso.data as ProgressoTema[]);

  return (
    <main className="mx-auto w-full max-w-6xl px-10 py-16">
      <h1 className="text-4xl font-semibold">Escolha um tema</h1>
      <p className="mt-3 text-texto-secundario">Cada tema tem seu próprio banco de programas-base e categorias de defeito.</p>
      <div className="mt-10 grid grid-cols-2 gap-6">
        {cards.map((tema) => (tema.ativo ? <CardAtivo key={tema.codigo} tema={tema} /> : <CardIndisponivel key={tema.codigo} tema={tema} />))}
      </div>
    </main>
  );
}

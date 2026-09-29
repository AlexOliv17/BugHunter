import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BotaoComecar } from "./BotaoComecar";
import { montarNiveis, type CardNivel, type NivelDoTema } from "@/lib/niveis";
import { exigirUsuario } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Nível de dificuldade · BugHunter" };

function Intensidade({ cheias, cor }: { cheias: number; cor: string }) {
  return (
    <span aria-hidden className="flex gap-1">
      {[0, 1, 2].map((i) => <span key={i} className={`h-7 w-2 ${i < cheias ? cor : "bg-borda"}`} />)}
    </span>
  );
}

function CardDisponivel({ card, tema }: { card: CardNivel; tema: string }) {
  const medio = card.nivel === "medio";
  return (
    <article className="group flex flex-col rounded border border-borda bg-painel p-8 transition-colors hover:border-destaque">
      <div className="flex items-start justify-between">
        <h2 className="text-2xl font-semibold">{card.titulo}</h2>
        <Intensidade cheias={medio ? 2 : 1} cor={medio ? "bg-destaque" : "bg-sucesso"} />
      </div>
      <p className="mt-6 text-texto-secundario">{card.descricao}</p>
      <h3 className="mt-6 text-xs font-semibold tracking-wider text-texto-apagado">CATEGORIAS</h3>
      <ul className="mt-3 flex flex-col gap-2 font-mono text-sm">
        {card.categorias.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <dl className="mt-auto flex flex-col gap-3 pt-8 text-sm">
        <div className="flex justify-between"><dt className="text-texto-secundario">PDR máximo</dt><dd className="font-semibold">{card.base} pts</dd></div>
        <div className="flex justify-between"><dt className="text-texto-secundario">Resolvidos</dt><dd className="font-semibold">{card.resolvidos} / {card.total}</dd></div>
      </dl>
      <BotaoComecar tema={tema} nivel={card.nivel} />
    </article>
  );
}

function CardAlto() {
  return (
    <article className="flex flex-col rounded border border-borda p-8 text-texto-apagado">
      <div className="flex items-start justify-between">
        <h2 className="text-2xl font-semibold">Alto <span className="sr-only">(indisponível)</span></h2>
        <span className="rounded border border-borda px-2 py-1 text-xs font-semibold">V2</span>
      </div>
      <p className="mt-6">O código passa em casos comuns e falha só nas bordas.</p>
      <p className="mt-auto pt-8 text-sm">Mutadores em construção</p>
    </article>
  );
}

export default async function PaginaNivel({ params }: PageProps<"/temas/[tema]">) {
  const { tema: codigo } = await params;
  await exigirUsuario(`/temas/${codigo}`);
  const supabase = await criarClienteServidor();

  const { data: tema } = await supabase.from("temas_publicos").select("codigo, nome, ativo").eq("codigo", codigo).maybeSingle();
  if (!tema || !tema.ativo) notFound();  // tema inexistente ou indisponível (RF-03)

  const { data, error } = await supabase.rpc("niveis_do_tema", { p_tema: codigo });
  if (error) throw new Error("Não foi possível carregar os níveis.");
  const niveis = montarNiveis(data as NivelDoTema[]);

  return (
    <main className="mx-auto w-full max-w-6xl px-10 py-12">
      <nav aria-label="Caminho" className="text-sm text-texto-secundario">
        <Link href="/temas" className="hover:text-texto">Temas</Link>
        <span aria-hidden className="mx-2">/</span>
        <span className="text-texto">{tema.nome}</span>
      </nav>
      <h1 className="mt-6 text-4xl font-semibold">Nível de dificuldade</h1>
      <p className="mt-3 text-texto-secundario">A dificuldade é definida pela categoria do defeito plantado — não pelo tamanho do código.</p>
      <div className="mt-10 grid grid-cols-3 gap-6">
        {niveis.map((card) => <CardDisponivel key={card.nivel} card={card} tema={tema.codigo} />)}
        <CardAlto />
      </div>
    </main>
  );
}

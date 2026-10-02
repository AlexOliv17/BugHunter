"use client";

// Tela de feedback final (S5-05, RF-15), conforme o protótipo FeedbackFinal: o que
// estava plantado, o correto e o que o aluno submeteu; a explicação do modelo (ou a
// reserva); o PDR final discriminado e a linha do tempo da tentativa.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import type { EstadoTentativa } from "@/lib/estado";
import { secoesDoFeedback, type MarcoDaLinhaDoTempo } from "@/lib/feedback";
import type { Nivel } from "@/lib/niveis";
import { Voltar } from "../../../Voltar";
import { Caminho, PainelPontuacao } from "../componentes";

type Resultado = {
  desfecho: string; pdr_final: number; numero_tentativa: number;
  exercicio: { assinatura: string; descricao: string; tema: string; nivel: Nivel; base: number };
  categoria: string; estado: EstadoTentativa; linha_do_tempo: MarcoDaLinhaDoTempo[];
  codigo_com_defeito: string; codigo_submetido: string; feedback: string | null;
};
type Gabarito = { codigo_correto: string; linha_defeito: number };

const lerJson = async (r: Response | null) => ({ ok: !!r?.ok, corpo: await r?.json().catch(() => null) });

export function TelaResultado({ tentativaId }: { tentativaId: string }) {
  const router = useRouter();
  const [dados, setDados] = useState<Resultado | null>(null);
  const [gabarito, setGabarito] = useState<Gabarito | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<"proximo" | "refazer" | null>(null);
  const [erroAbrir, setErroAbrir] = useState<string | null>(null);

  // Próximo exercício do nível (D-29) ou o mesmo de novo, valendo metade (RF-16, RN-07)
  const abrir = async (qual: "proximo" | "refazer") => {
    setAbrindo(qual);
    setErroAbrir(null);
    const r = await fetch(`/api/${qual}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tentativa_id: tentativaId }),
    }).catch(() => null).then(lerJson);
    if (r.ok) return router.push(`/exercicio/${r.corpo.tentativa_id}`);
    setAbrindo(null);
    setErroAbrir(r.corpo?.erro ?? "Não foi possível abrir o exercício agora.");
  };

  useEffect(() => {
    let ativo = true;
    Promise.all([
      fetch(`/api/feedback/${tentativaId}`).catch(() => null).then(lerJson),
      fetch(`/api/gabarito/${tentativaId}`).catch(() => null).then(lerJson),
    ]).then(async ([r, g]) => {
      if (!ativo) return;
      // ainda aberta: o lugar dela é a tela do exercício
      if (r.corpo?.erro && /aberta/.test(r.corpo.erro)) return router.replace(`/exercicio/${tentativaId}`);
      if (!r.ok || !g.ok) return setErro(r.corpo?.erro ?? g.corpo?.erro ?? "Não foi possível carregar o resultado.");
      setDados(r.corpo);
      setGabarito(g.corpo);
      if (r.corpo.feedback) return setFeedback(r.corpo.feedback);
      // o feedback ainda não foi gravado: pede a geração (no máximo 15 s, com reserva)
      setGerando(true);
      const f = await fetch(`/api/feedback/${tentativaId}`, { method: "POST" }).catch(() => null).then(lerJson);
      if (!ativo) return;
      setGerando(false);
      setFeedback(f.ok ? f.corpo.feedback : null);
    });
    return () => {
      ativo = false;
    };
  }, [tentativaId, router]);

  if (erro) {
    return (
      <main className="mx-auto w-full max-w-4xl px-10 py-16">
        <p role="alert" className="text-perigo">{erro}</p>
        <Link href="/temas" className="mt-4 inline-block text-destaque hover:underline">Voltar aos temas</Link>
      </main>
    );
  }
  if (!dados || !gabarito) return <main className="mx-auto w-full max-w-4xl px-10 py-16 text-texto-secundario">Carregando o resultado…</main>;

  const resolvido = dados.desfecho === "resolvido";
  return (
    <main className="mx-auto w-full max-w-[1400px] px-10 py-8">
      <div className="flex items-center gap-6">
        <Voltar href={`/temas/${dados.exercicio.tema}`} para="a escolha de nível" />
        <Caminho exercicio={dados.exercicio} final="Exercício — encerrado" />
      </div>
      <h1 className="mt-8 text-4xl font-semibold">{resolvido ? "Exercício resolvido" : "Tentativa encerrada"}</h1>
      <p className="mt-3 text-texto-secundario">
        {resolvido
          ? "Você passou na suíte completa. Abaixo, o que estava plantado e o que observar da próxima vez."
          : "Você desistiu antes de passar na suíte completa. Abaixo, o que estava plantado e como se procura por isso."}
      </p>

      <div className="mt-8 grid grid-cols-[1fr_24rem] gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <Comparacao dados={dados} gabarito={gabarito} />
          <TextoDoFeedback texto={feedback} gerando={gerando} />
          <CodigosCompletos dados={dados} gabarito={gabarito} />
        </div>
        <aside className="flex flex-col gap-6">
          <PainelPontuacao exercicio={dados.exercicio} estado={dados.estado} numeroTentativa={dados.numero_tentativa} />
          <LinhaDoTempo marcos={dados.linha_do_tempo} />
        </aside>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => abrir("proximo")} disabled={abrindo !== null}
          className="h-14 rounded bg-destaque px-8 font-semibold text-sobre-destaque transition-opacity enabled:hover:opacity-90 disabled:opacity-60">
          {abrindo === "proximo" ? "Abrindo…" : "Próximo exercício"}
        </button>
        <button type="button" onClick={() => abrir("refazer")} disabled={abrindo !== null}
          className="h-14 rounded border border-borda px-8 font-semibold transition-colors enabled:hover:border-texto-apagado disabled:opacity-60">
          {abrindo === "refazer" ? "Abrindo…" : "Tentar este de novo (vale 50%)"}
        </button>
      </div>
      {erroAbrir && <p role="alert" className="mt-3 text-sm text-perigo">{erroAbrir}</p>}
    </main>
  );
}

// Linha do defeito: plantado, correto e o que o aluno deixou nela (protótipo).
function Comparacao({ dados, gabarito }: { dados: Resultado; gabarito: Gabarito }) {
  const i = gabarito.linha_defeito - 1;
  const linha = (codigo: string) => codigo.split("\n")[i]?.trim() ?? "";
  const linhas: [string, string, string][] = [
    ["PLANTADO", linha(dados.codigo_com_defeito), "border-perigo bg-perigo/5 text-perigo"],
    ["CORRETO", linha(gabarito.codigo_correto), "border-sucesso bg-sucesso/5 text-sucesso"],
    ["SEU CÓDIGO", linha(dados.codigo_submetido), "border-borda bg-fundo text-texto-secundario"],
  ];
  return (
    <section aria-label="O defeito" className="rounded border border-borda bg-painel p-8">
      <div className="flex items-center gap-4">
        <h2 className="text-xs font-semibold tracking-wider text-texto-secundario">CATEGORIA DO DEFEITO</h2>
        <span className="rounded bg-destaque/10 px-3 py-1 font-mono text-sm text-destaque">{dados.categoria}</span>
        <span className="ml-auto text-sm text-texto-secundario">linha {gabarito.linha_defeito}</span>
      </div>
      <dl className="mt-6 flex flex-col gap-3">
        {linhas.map(([rotulo, codigo, cor]) => (
          <div key={rotulo} className="grid grid-cols-[8rem_1fr] items-center gap-4">
            <dt className={`text-xs font-semibold tracking-wider ${cor.split(" ").at(-1)}`}>{rotulo}</dt>
            <dd className={`overflow-x-auto whitespace-pre rounded-r border-l-2 px-4 py-2 font-mono text-sm text-texto ${cor.split(" ").slice(0, 2).join(" ")}`}>{codigo || " "}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// `trecho` vira código; o resto é texto.
function comCodigo(texto: string): ReactNode[] {
  return texto.split(/(`[^`]+`)/g).map((parte, i) =>
    parte.startsWith("`") && parte.endsWith("`") && parte.length > 1
      ? <code key={i} className="rounded bg-fundo px-1 font-mono text-[0.9em] text-destaque">{parte.slice(1, -1)}</code>
      : parte);
}

function TextoDoFeedback({ texto, gerando }: { texto: string | null; gerando: boolean }) {
  return (
    <section aria-label="Feedback" aria-busy={gerando} className="rounded border border-borda bg-painel p-8">
      {gerando && <p className="text-texto-secundario">Preparando a explicação da sua tentativa…</p>}
      {!gerando && !texto && <p className="text-texto-secundario">A explicação não pôde ser carregada agora. Recarregue a página para tentar de novo.</p>}
      {texto && (
        <div className="flex flex-col gap-6">
          {secoesDoFeedback(texto).map((s, i) => (
            <div key={i}>
              {s.titulo && <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-secundario">{s.titulo}</h2>}
              {s.paragrafos.map((p, j) => <p key={j} className="mt-3 leading-7">{comCodigo(p)}</p>)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Os três códigos completos, lado a lado (RF-15).
function CodigosCompletos({ dados, gabarito }: { dados: Resultado; gabarito: Gabarito }) {
  const colunas: [string, string][] = [
    ["Plantado", dados.codigo_com_defeito], ["Correto", gabarito.codigo_correto], ["Seu código", dados.codigo_submetido],
  ];
  return (
    <details className="rounded border border-borda bg-painel">
      <summary className="cursor-pointer px-8 py-4 text-sm font-semibold text-texto-secundario hover:text-texto">Ver os três códigos completos</summary>
      <div className="grid grid-cols-3 gap-px border-t border-borda bg-borda">
        {colunas.map(([titulo, codigo]) => (
          <div key={titulo} className="min-w-0 bg-painel p-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-texto-secundario">{titulo.toUpperCase()}</h3>
            <pre className="overflow-x-auto font-mono text-xs leading-6">
              {codigo.split("\n").map((l, i) => (
                <div key={i} className={i === gabarito.linha_defeito - 1 ? "bg-destaque/10" : undefined}>
                  <span className="mr-3 inline-block w-5 select-none text-right text-texto-apagado">{i + 1}</span>{l}
                </div>
              ))}
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}

function LinhaDoTempo({ marcos }: { marcos: MarcoDaLinhaDoTempo[] }) {
  const hora = (em: string) => new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <section aria-label="Linha do tempo" className="rounded border border-borda bg-painel p-8">
      <h2 className="text-xs font-semibold tracking-wider text-texto-secundario">LINHA DO TEMPO</h2>
      <ol className="mt-5 flex flex-col gap-3 text-sm">
        {marcos.map((m, i) => (
          <li key={i} className="flex gap-4">
            <time dateTime={m.em} className="font-mono text-texto-apagado">{hora(m.em)}</time>
            <span>
              {m.texto}
              {m.destaque && <> — <span className={m.tom === "ok" ? "text-sucesso" : m.tom === "erro" ? "text-perigo" : ""}>{m.destaque}</span></>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

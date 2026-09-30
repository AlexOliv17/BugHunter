"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { RespostaTentativa } from "@/lib/tentativa";
import { AvisoLocalizacao, BarraAcoes, Caminho, Enunciado, PainelDicas, PainelPontuacao, TesteExemplo } from "./componentes";

// Tela do exercício (telas 4, 5 e 6 — mesma rota em estados diferentes). Carrega a
// tentativa pelo endpoint (D-20) e monta o layout dos protótipos (S3-01).
export function TelaExercicio({ tentativaId }: { tentativaId: string }) {
  const [dados, setDados] = useState<RespostaTentativa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/tentativa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tentativa_id: tentativaId }),
    })
      .then(async (r) => ({ ok: r.ok, corpo: await r.json().catch(() => null) }))
      .then(({ ok, corpo }) => {
        if (!ativo) return;
        if (ok) setDados(corpo);
        else setErro(corpo?.erro ?? "Não foi possível carregar o exercício.");
      })
      .catch(() => ativo && setErro("Não foi possível carregar o exercício."));
    return () => {
      ativo = false;
    };
  }, [tentativaId]);

  if (erro) {
    return (
      <main className="mx-auto w-full max-w-4xl px-10 py-16">
        <p role="alert" className="text-perigo">{erro}</p>
        <Link href="/temas" className="mt-4 inline-block text-destaque hover:underline">Voltar aos temas</Link>
      </main>
    );
  }
  if (!dados) return <main className="mx-auto w-full max-w-4xl px-10 py-16 text-texto-secundario">Carregando o exercício…</main>;

  const { exercicio, tentativa } = dados;
  const editorTravado = true; // máquina de estados travado → liberado: S3-04

  return (
    <main className="mx-auto grid w-full max-w-[1400px] grid-cols-[1fr_24rem] gap-8 px-10 py-8">
      <div className="flex min-w-0 flex-col gap-6">
        <Caminho exercicio={exercicio} />
        <Enunciado exercicio={exercicio} />
        <TesteExemplo exercicio={exercicio} />

        <section aria-label="Código" className="overflow-hidden rounded border border-destaque">
          <header className="flex items-center justify-between border-b border-destaque/60 bg-destaque/10 px-6 py-3">
            <span className="font-semibold text-destaque">Editor travado</span>
            <span className="text-sm text-texto-secundario">Clique na linha onde você acha que está o defeito</span>
          </header>
          {/* Editor CodeMirror 6: S3-02 */}
          <pre className="bg-painel py-4 font-mono text-sm leading-8">
            {exercicio.codigo.split("\n").map((linha, i) => (
              <div key={i} className="flex px-4">
                <span aria-hidden className="w-10 shrink-0 select-none text-texto-apagado">{i + 1}</span>
                <span>{linha}</span>
              </div>
            ))}
          </pre>
        </section>

        <BarraAcoes editorTravado={editorTravado} />
      </div>

      <aside className="flex flex-col gap-6">
        <PainelPontuacao exercicio={exercicio} multiplicadorRepeticao={tentativa.multiplicador_repeticao} />
        {editorTravado && <AvisoLocalizacao />}
        <PainelDicas editorTravado={editorTravado} />
      </aside>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { RespostaTentativa } from "@/lib/tentativa";
import { EditorCodigo } from "./EditorCodigo";
import { modoLocalizacao } from "./localizacao";
import { AvisoLocalizacao, BarraAcoes, Caminho, Enunciado, PainelDicas, PainelPontuacao, TesteExemplo } from "./componentes";

// Tela do exercício (telas 4, 5 e 6 — mesma rota em estados diferentes). Carrega a
// tentativa pelo endpoint (D-20) e monta o layout dos protótipos (S3-01).
export function TelaExercicio({ tentativaId }: { tentativaId: string }) {
  const [dados, setDados] = useState<RespostaTentativa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [linhasErradas, setLinhasErradas] = useState<number[]>([]);
  const [aviso, setAviso] = useState<{ tipo: "certo" | "errado" | "erro"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Clique numa linha (RF-07): o servidor compara com linha_defeito e diz só se acertou.
  const apontar = useCallback(async (linha: number) => {
    if (enviando) return;
    setEnviando(true);
    const r = await fetch("/api/localizar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tentativa_id: tentativaId, linha }),
    }).catch(() => null);
    const corpo = await r?.json().catch(() => null);
    setEnviando(false);
    if (!r?.ok) return setAviso({ tipo: "erro", texto: corpo?.erro ?? "Não foi possível registrar a linha agora." });
    if (corpo.correta) setAviso({ tipo: "certo", texto: `Linha ${linha}: correta.` });
    else {
      setLinhasErradas((l) => [...l, linha]);
      setAviso({ tipo: "errado", texto: corpo.concluida ? `Linha ${linha}: incorreta.` : `Linha ${linha}: incorreta. Você tem mais uma tentativa.` });
    }
  }, [enviando, tentativaId]);

  const extensoesLocalizacao = useMemo(
    () => modoLocalizacao({ aoApontar: apontar, linhasErradas, ativo: true }),
    [apontar, linhasErradas],
  );

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
          <EditorCodigo codigo={exercicio.codigo} somenteLeitura={editorTravado} extensoes={extensoesLocalizacao} rotulo="Código do exercício. Clique na linha onde está o defeito." />
          {aviso && (
            <p role="status" className={`border-t border-borda px-6 py-3 text-sm ${aviso.tipo === "certo" ? "text-sucesso" : aviso.tipo === "errado" ? "text-perigo" : "text-texto-secundario"}`}>
              {aviso.texto}
            </p>
          )}
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

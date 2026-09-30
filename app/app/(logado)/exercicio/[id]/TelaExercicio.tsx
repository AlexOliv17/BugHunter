"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { reconstruirEstado } from "@/lib/estado";
import { contarLinhasAlteradas, LIMITE_ALERTA } from "@/lib/linhas-alteradas";
import { reduzir } from "@/lib/maquina-exercicio";
import type { RespostaTentativa } from "@/lib/tentativa";
import { AvisoLocalizacao, BarraAcoes, Caminho, Enunciado, PainelDicas, PainelPontuacao, TesteExemplo } from "./componentes";
import { EditorCodigo } from "./EditorCodigo";
import { modoLocalizacao } from "./localizacao";
import { marcasDeEdicao } from "./marcas-edicao";

type Aviso = { tipo: "certo" | "errado" | "erro"; texto: string };

// Tela do exercício (telas 4, 5 e 6 — mesma rota em estados diferentes). Carrega a
// tentativa pelo endpoint (D-20), com o estado reconstruído dos eventos (RN-10).
export function TelaExercicio({ tentativaId }: { tentativaId: string }) {
  const [dados, setDados] = useState<RespostaTentativa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [estado, despachar] = useReducer(reduzir, reconstruirEstado([]));
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [codigoAtual, setCodigoAtual] = useState<string | null>(null);

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
        if (!ok) return setErro(corpo?.erro ?? "Não foi possível carregar o exercício.");
        setDados(corpo);
        despachar({ tipo: "carregou", estado: corpo.estado });
      })
      .catch(() => ativo && setErro("Não foi possível carregar o exercício."));
    return () => {
      ativo = false;
    };
  }, [tentativaId]);

  // Clique numa linha (RF-07): o servidor compara com linha_defeito e diz só se acertou.
  const apontar = useCallback(async (linha: number) => {
    const r = await fetch("/api/localizar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tentativa_id: tentativaId, linha }),
    }).catch(() => null);
    const corpo = await r?.json().catch(() => null);
    if (!r?.ok) return setAviso({ tipo: "erro", texto: corpo?.erro ?? "Não foi possível registrar a linha agora." });

    despachar({ tipo: "localizou", linha, correta: corpo.correta });
    if (corpo.correta) setAviso({ tipo: "certo", texto: `Linha ${linha}: correta. O editor está liberado.` });
    else if (corpo.concluida) setAviso({ tipo: "errado", texto: `Linha ${linha}: incorreta. O editor foi liberado mesmo assim, com a menor pontuação de localização.` });
    else setAviso({ tipo: "errado", texto: `Linha ${linha}: incorreta. Você tem mais uma tentativa.` });
  }, [tentativaId]);

  const travado = !estado.editorLiberado;
  const linhasErradas = useMemo(() => estado.localizacao.tentativas.filter((t) => !t.correta).map((t) => t.linha), [estado.localizacao.tentativas]);
  const original = dados?.exercicio.codigo ?? "";
  const extensoes = useMemo(
    () => (travado ? modoLocalizacao({ aoApontar: apontar, linhasErradas, ativo: true }) : marcasDeEdicao(original)),
    [apontar, linhasErradas, travado, original],
  );
  // RN-08: linhas alteradas em relação ao código recebido; informativo (D-02)
  const alteradas = useMemo(() => contarLinhasAlteradas(original, codigoAtual ?? original), [original, codigoAtual]);

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
  const restantes = 2 - estado.localizacao.tentativas.length;

  return (
    <main className="mx-auto grid w-full max-w-[1400px] grid-cols-[1fr_24rem] gap-8 px-10 py-8">
      <div className="flex min-w-0 flex-col gap-6">
        <Caminho exercicio={exercicio} />
        <Enunciado exercicio={exercicio} />
        <TesteExemplo exercicio={exercicio} />

        <section aria-label="Código" className={`overflow-hidden rounded border ${travado ? "border-destaque" : "border-borda"}`}>
          <header className={`flex items-center justify-between border-b px-6 py-3 ${travado ? "border-destaque/60 bg-destaque/10" : "border-borda bg-painel"}`}>
            <span className={`font-semibold ${travado ? "text-destaque" : "text-sucesso"}`}>{travado ? "Editor travado" : "Editor destravado"}</span>
            {travado ? (
              <span className="text-sm text-texto-secundario">
                Clique na linha onde você acha que está o defeito · {restantes === 2 ? "2 tentativas" : "última tentativa"}
              </span>
            ) : (
              <span role="status" className={`font-mono text-sm ${alteradas > LIMITE_ALERTA ? "font-semibold text-perigo" : "text-destaque"}`}>
                {alteradas} {alteradas === 1 ? "linha alterada" : "linhas alteradas"}
                {alteradas > LIMITE_ALERTA && " · acima de 3: corrija o defeito, não reescreva a função"}
              </span>
            )}
          </header>
          <EditorCodigo codigo={exercicio.codigo} somenteLeitura={travado} extensoes={extensoes} aoMudar={setCodigoAtual}
            rotulo={travado ? "Código do exercício. Clique na linha onde está o defeito." : "Código do exercício, editável."} />
          {aviso && (
            <p role="status" className={`border-t border-borda px-6 py-3 text-sm ${aviso.tipo === "certo" ? "text-sucesso" : aviso.tipo === "errado" ? "text-perigo" : "text-texto-secundario"}`}>
              {aviso.texto}
            </p>
          )}
        </section>

        <BarraAcoes editorTravado={travado} />
      </div>

      <aside className="flex flex-col gap-6">
        <PainelPontuacao exercicio={exercicio} multiplicadorRepeticao={tentativa.multiplicador_repeticao} localizacao={estado.localizacao} />
        {travado && <AvisoLocalizacao />}
        <PainelDicas editorTravado={travado} />
      </aside>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { reconstruirEstado } from "@/lib/estado";
import { contarLinhasAlteradas, LIMITE_ALERTA } from "@/lib/linhas-alteradas";
import { LIMITE_USOS, nomeDaFuncao, obtidoDoResultado, precheckDisponivel, resultadoDoUso } from "@/lib/precheck";
import { situacaoDasDicas, type NivelDica } from "@/lib/dicas";
import { reduzir } from "@/lib/maquina-exercicio";
import { pdrDoEstado } from "@/lib/pdr";
import type { RespostaTentativa } from "@/lib/tentativa";
import { AvisoLocalizacao, BarraAcoes, Caminho, ConfirmarDesistencia, Enunciado, PainelDicas, PainelPontuacao, ResultadoDoPrecheck, ResultadoDoVerificar, TesteExemplo } from "./componentes";
import { Voltar } from "../../Voltar";
import { EditorCodigo } from "./EditorCodigo";
import { modoLocalizacao } from "./localizacao";
import { marcasDeEdicao } from "./marcas-edicao";
import { usePrecheck } from "./usePrecheck";

type Aviso = { tipo: "certo" | "errado" | "erro"; texto: string };

// Tela do exercício (telas 4, 5 e 6 — mesma rota em estados diferentes). Carrega a
// tentativa pelo endpoint (D-20), com o estado reconstruído dos eventos (RN-10).
export function TelaExercicio({ tentativaId }: { tentativaId: string }) {
  const router = useRouter();
  const [dados, setDados] = useState<RespostaTentativa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [estado, despachar] = useReducer(reduzir, reconstruirEstado([]));
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // rascunho: o que está no editor agora; estado.codigoAtual: o último código registrado
  const [rascunho, setRascunho] = useState<string | null>(null);
  const precheck = usePrecheck();
  const [enviando, setEnviando] = useState(false);   // cobre os dois POSTs e a execução
  const [verificando, setVerificando] = useState(false);
  const [textosDicas, setTextosDicas] = useState<Partial<Record<NivelDica, string>>>({});
  const [pedindoDica, setPedindoDica] = useState<NivelDica | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [desistindo, setDesistindo] = useState(false);

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
        // encerrada: o lugar dela é o resultado (RF-15)
        if (corpo?.encerrada) return router.replace(`/exercicio/${tentativaId}/resultado`);
        if (!ok) return setErro(corpo?.erro ?? "Não foi possível carregar o exercício.");
        setDados(corpo);
        despachar({ tipo: "carregou", estado: corpo.estado });
        setTextosDicas(Object.fromEntries((corpo.dicas ?? []).map((d: { nivel: number; texto: string }) => [d.nivel, d.texto])));
      })
      .catch(() => ativo && setErro("Não foi possível carregar o exercício."));
    return () => {
      ativo = false;
    };
  }, [tentativaId, router]);

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
  const encerrada = estado.encerrada !== null;
  const ocupado = enviando || verificando;
  const linhasErradas = useMemo(() => estado.localizacao.tentativas.filter((t) => !t.correta).map((t) => t.linha), [estado.localizacao.tentativas]);
  const original = dados?.exercicio.codigo ?? "";
  const extensoes = useMemo(
    () => (travado ? modoLocalizacao({ aoApontar: apontar, linhasErradas, ativo: true }) : marcasDeEdicao(original)),
    [apontar, linhasErradas, travado, original],
  );
  const codigoNoEditor = rascunho ?? estado.codigoAtual ?? original;
  // RN-08: linhas alteradas em relação ao código recebido; informativo (D-02)
  const alteradas = useMemo(() => contarLinhasAlteradas(original, codigoNoEditor), [original, codigoNoEditor]);
  const usados = estado.prechecks.usados;

  const postar = async (rota: string, corpo: Record<string, unknown>) => {
    const r = await fetch(rota, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tentativa_id: tentativaId, ...corpo }),
    }).catch(() => null);
    return { ok: !!r?.ok, corpo: await r?.json().catch(() => null) };
  };

  // Precheck (RF-09): só o teste de exemplo, no navegador; não altera a pontuação.
  // O código é registrado antes (evento editou, RN-12) e o uso depois; o número do
  // uso vem do servidor, que recusa o quarto (RN-02).
  const rodarPrecheck = async () => {
    if (!dados || encerrada || !precheckDisponivel(usados, estado.editorLiberado)) return;
    if (ocupado || precheck.ambiente !== "pronto") return;   // ainda carregando: não consome uso (decisão 1.7)
    setEnviando(true);
    try {
      await registrarEExecutar(dados, codigoNoEditor);
    } finally {
      setEnviando(false);
    }
  };

  const registrarEExecutar = async (dados: RespostaTentativa, codigo: string) => {
    const edicao = await postar("/api/editou", { codigo });
    if (!edicao.ok) return setAviso({ tipo: "erro", texto: edicao.corpo?.erro ?? "Não foi possível registrar o código agora." });
    despachar({ tipo: "editou", codigo });

    const t = dados.exercicio.teste_exemplo;
    const resultado = await precheck.executar({
      codigo, funcao: nomeDaFuncao(dados.exercicio.assinatura), entrada: t.entrada, esperado: t.esperado,
    });
    // conta também o que estourou o tempo (D-10)
    const obtido = obtidoDoResultado(resultado);
    const registro = await postar("/api/precheck", { resultado: resultado.resultado, obtido });
    if (!registro.ok) return setAviso({ tipo: "erro", texto: registro.corpo?.erro ?? "Não foi possível registrar o Precheck agora." });
    setAviso(null);
    despachar({ tipo: "precheck", uso: { resultado: resultado.resultado, obtido, numero_uso: registro.corpo.numero_uso } });
  };

  // Verificar (RF-10): o servidor grava o código, roda a suíte oculta e compara.
  const rodarVerificar = async () => {
    if (!dados || travado || encerrada || ocupado) return;
    const codigo = codigoNoEditor;
    setVerificando(true);
    try {
      const r = await postar("/api/verificar", { codigo });
      if (!r.ok) return setAviso({ tipo: "erro", texto: r.corpo?.erro ?? "Não foi possível verificar agora." });
      setAviso(null);
      despachar({ tipo: "editou", codigo });
      despachar({ tipo: "verificou", encerrada: r.corpo.encerrada === true,
        resultado: { resultado: r.corpo.resultado, passados: r.corpo.passados, total: r.corpo.total } });
      // resolveu: o aluno é levado ao feedback final (RF-10)
      if (r.corpo.encerrada === true) router.push(`/exercicio/${tentativaId}/resultado`);
    } finally {
      setVerificando(false);
    }
  };
  const ultimoVerificar = estado.verificacoes.at(-1);

  // Desistência (RF-13): grava o código atual e encerra com PDR 0; depois, o resultado.
  const desistir = async () => {
    if (desistindo) return;
    setDesistindo(true);
    const r = await postar("/api/encerrar", { codigo: codigoNoEditor });
    if (r.ok || r.corpo?.erro === "Esta tentativa já foi encerrada.") return router.push(`/exercicio/${tentativaId}/resultado`);
    setDesistindo(false);
    setConfirmando(false);
    setAviso({ tipo: "erro", texto: r.corpo?.erro ?? "Não foi possível encerrar agora." });
  };

  // Dica (RF-12): o servidor confere a liberação, grava o evento e devolve o texto.
  const pedirDica = async (nivel: NivelDica) => {
    if (pedindoDica !== null) return;
    setPedindoDica(nivel);
    try {
      const r = await postar("/api/dica", { nivel });
      if (!r.ok) return setAviso({ tipo: "erro", texto: r.corpo?.erro ?? "Não foi possível abrir a dica agora." });
      setTextosDicas((t) => ({ ...t, [nivel]: r.corpo.texto }));
      despachar({ tipo: "dica", nivel });
    } finally {
      setPedindoDica(null);
    }
  };

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
        <div className="flex items-center gap-6">
          <Voltar href={`/temas/${exercicio.tema}`} para="a escolha de nível" />
          <Caminho exercicio={exercicio} />
        </div>
        <Enunciado exercicio={exercicio} />
        <TesteExemplo exercicio={exercicio} />

        <section aria-label="Código" className={`overflow-hidden rounded border ${travado ? "border-destaque" : "border-borda"}`}>
          <header className={`flex items-center justify-between border-b px-6 py-3 ${travado ? "border-destaque/60 bg-destaque/10" : "border-borda bg-painel"}`}>
            <span className={`font-semibold ${travado ? "text-destaque" : "text-sucesso"}`}>{travado ? "Editor travado" : encerrada ? "Tentativa encerrada" : "Editor destravado"}</span>
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
          <EditorCodigo codigo={estado.codigoAtual ?? exercicio.codigo} somenteLeitura={travado || encerrada} extensoes={extensoes} aoMudar={setRascunho}
            rotulo={travado ? "Código do exercício. Clique na linha onde está o defeito." : "Código do exercício, editável."} />
          {aviso && (
            <p role="status" className={`border-t border-borda px-6 py-3 text-sm ${aviso.tipo === "certo" ? "text-sucesso" : aviso.tipo === "errado" ? "text-perigo" : "text-texto-secundario"}`}>
              {aviso.texto}
            </p>
          )}
        </section>

        {estado.prechecks.ultimo && (
          <ResultadoDoPrecheck resultado={resultadoDoUso(estado.prechecks.ultimo)} uso={estado.prechecks.ultimo.numero_uso} limite={LIMITE_USOS} exercicio={exercicio} />
        )}

        {ultimoVerificar && (
          <ResultadoDoVerificar resultado={ultimoVerificar} numero={estado.verificacoes.length}
            pdrFinal={encerrada ? pdrDoEstado(estado, { base: exercicio.base, numero_tentativa: tentativa.numero, treino: tentativa.treino }).pdr : null} />
        )}

        <BarraAcoes editorTravado={travado} aoPrecheck={rodarPrecheck} precheck={{
          usados, limite: LIMITE_USOS,
          disponivel: !encerrada && !verificando && precheckDisponivel(usados, estado.editorLiberado),
          preparando: precheck.ambiente === "carregando", executando: enviando || precheck.ambiente === "executando",
        }} aoVerificar={rodarVerificar} verificar={{ disponivel: !travado && !encerrada && !enviando, executando: verificando }}
          desistir={{ disponivel: !encerrada && !ocupado }} aoDesistir={() => setConfirmando(true)} />
        {confirmando && <ConfirmarDesistencia enviando={desistindo} aoConfirmar={desistir} aoCancelar={() => setConfirmando(false)} />}
      </div>

      <aside className="flex flex-col gap-6">
        <PainelPontuacao exercicio={exercicio} estado={estado} numeroTentativa={tentativa.numero} treino={tentativa.treino} />
        {travado && <AvisoLocalizacao />}
        <PainelDicas situacoes={situacaoDasDicas(estado)} textos={textosDicas} pedindo={pedindoDica} aoPedir={pedirDica} />
      </aside>
    </main>
  );
}

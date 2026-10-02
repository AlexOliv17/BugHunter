// Blocos da tela do exercício (S3-01), conforme os protótipos ExercicioLocalizar e
// ExercicioPrecheck. Só apresentação: o estado vive em TelaExercicio.

import Link from "next/link";

import type { EstadoTentativa, ResultadoVerificacao } from "@/lib/estado";
import { CUSTO_DICA, NIVEIS_DICA, TITULO_DICA, type NivelDica, type SituacaoDica } from "@/lib/dicas";
import { PESO_LOCALIZACAO, PESO_REPARO, pdrDoEstado } from "@/lib/pdr";
import type { ResultadoPrecheck } from "@/lib/precheck";
import type { RespostaTentativa } from "@/lib/tentativa";

type Exercicio = RespostaTentativa["exercicio"];

const nomeNivel = (nivel: string) => (nivel === "medio" ? "Médio" : "Baixo");

export function Caminho({ exercicio, final = "Exercício" }: { exercicio: Pick<Exercicio, "tema" | "nivel">; final?: string }) {
  return (
    <nav aria-label="Caminho" className="text-sm text-texto-secundario">
      <Link href="/temas" className="hover:text-texto">Temas</Link>
      <span aria-hidden className="mx-2">/</span>
      <Link href={`/temas/${exercicio.tema}`} className="hover:text-texto">{nomeNivel(exercicio.nivel)}</Link>
      <span aria-hidden className="mx-2">/</span>
      <span className="text-texto">{final}</span>
    </nav>
  );
}

export function Enunciado({ exercicio }: { exercicio: Exercicio }) {
  return (
    <section aria-label="Enunciado" className="rounded border border-borda bg-painel px-8 py-6">
      <dl className="grid grid-cols-[8rem_1fr] gap-y-3">
        <dt className="font-medium text-texto-secundario">Função</dt>
        <dd className="font-mono text-destaque">{exercicio.assinatura}</dd>
        <dt className="font-medium text-texto-secundario">Descrição</dt>
        <dd>{exercicio.descricao}</dd>
      </dl>
    </section>
  );
}

export function TesteExemplo({ exercicio }: { exercicio: Exercicio }) {
  const t = exercicio.teste_exemplo;
  return (
    <table className="w-full table-fixed border-collapse overflow-hidden rounded border border-borda text-left">
      <thead className="bg-painel text-xs font-semibold tracking-wider text-texto-secundario">
        <tr>
          <th className="w-1/2 border-r border-borda px-6 py-3">TESTE DE EXEMPLO</th>
          <th className="border-r border-borda px-6 py-3">ENTRADA</th>
          <th className="px-6 py-3">RESULTADO</th>
        </tr>
      </thead>
      <tbody className="font-mono text-sm">
        <tr>
          <td className="border-r border-t border-borda px-6 py-4">{t.chamada}</td>
          <td className="border-r border-t border-borda px-6 py-4">{t.entrada_repr}</td>
          <td className="border-t border-borda px-6 py-4 text-sucesso">{t.esperado_repr}</td>
        </tr>
      </tbody>
    </table>
  );
}

const pct = (x: number) => `−${Math.round(x * 100)}%`;

// Painel de pontuação ao vivo (S4-04, RF-14): o mesmo cálculo do servidor (RN-05),
// com o efeito de cada componente. Localização e reparo pesam sobre a base (40% e
// 60%); dica e repetição multiplicam o resultado.
export function PainelPontuacao({ exercicio, estado, numeroTentativa, treino = false }: {
  exercicio: Pick<Exercicio, "base" | "nivel">; estado: EstadoTentativa; numeroTentativa: number; treino?: boolean;
}) {
  const { componentes: c, pdr, final } = pdrDoEstado(estado, { base: exercicio.base, numero_tentativa: numeroTentativa, treino });
  const loc = estado.localizacao;
  const falhas = estado.verificacoes.filter((v) => v.resultado !== "passou").length;
  const maiorDica = estado.dicasUsadas.length ? Math.max(...estado.dicasUsadas) : 0;

  const linhas: { rotulo: string; valor: string; tom: "ok" | "perda" | "neutro" }[] = [];
  if (loc.concluida) {
    const perda = PESO_LOCALIZACAO * (1 - c.fatorLocalizacao);
    const rotulo = loc.tentativas[0]?.correta ? "Localização na 1ª" : loc.acertou ? "Localização na 2ª" : "Localização não acertada";
    linhas.push({ rotulo, valor: perda ? pct(perda) : "cheio", tom: perda ? "perda" : "ok" });
  } else if (!estado.encerrada) {
    linhas.push({ rotulo: loc.tentativas.length ? "Localização: última tentativa" : "Localização em andamento", valor: "—", tom: "neutro" });
  }
  if (falhas) linhas.push({ rotulo: `Verificar sem sucesso × ${falhas}`, valor: pct(PESO_REPARO * (1 - c.fatorReparo)), tom: "perda" });
  if (maiorDica) linhas.push({ rotulo: `Dica ${maiorDica} usada`, valor: pct(1 - c.multiplicadorDica), tom: "perda" });
  if (c.multiplicadorRepeticao < 1) linhas.push({ rotulo: "Repetição do exercício", valor: pct(1 - c.multiplicadorRepeticao), tom: "perda" });
  if (c.desistiu) linhas.push({ rotulo: "Desistência", valor: "zera o PDR", tom: "perda" });
  else if (c.treino) linhas.push({ rotulo: "Treino: exercício já resolvido", valor: "não conta pontos", tom: "neutro" });

  const cor = { ok: "text-sucesso", perda: "text-perigo", neutro: "text-texto-apagado" };
  return (
    <section aria-label="Pontuação" className="rounded border border-borda bg-painel p-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-texto-secundario">{final ? "PDR FINAL" : "PDR EM JOGO"}</h2>
        <span aria-live="polite" className={`text-5xl font-semibold ${!final ? "text-destaque" : pdr > 0 ? "text-sucesso" : "text-texto-secundario"}`}>{pdr}</span>
      </div>
      <dl className="mt-6 flex flex-col gap-2 text-sm">
        <div className="flex justify-between"><dt className="text-texto-secundario">Base — {nomeNivel(exercicio.nivel).toLowerCase()}</dt><dd className="font-mono">{exercicio.base}</dd></div>
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex justify-between gap-4">
            <dt className="text-texto-secundario">{l.rotulo}</dt><dd className={`font-mono ${cor[l.tom]}`}>{l.valor}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs leading-5 text-texto-apagado">
        {c.treino ? "Você já resolveu este exercício: esta tentativa é treino e não soma pontos. Vale a nota da primeira resolução."
          : final ? `de ${exercicio.base} possíveis neste nível.` : "O máximo que ainda dá para fazer, se o próximo passo der certo."}
      </p>
    </section>
  );
}

export function AvisoLocalizacao() {
  // Efeito no PDR total: a localização vale 40%; fatores 1,0 / 0,6 / 0,3 (RN-01, RN-05).
  return (
    <section aria-label="Antes de editar" className="rounded border border-destaque/40 bg-destaque/5 p-8">
      <h2 className="font-semibold text-destaque">Antes de editar</h2>
      <p className="mt-3 text-sm leading-6 text-texto-secundario">
        A localização vale 40% do PDR deste exercício. Você tem duas tentativas de apontar a linha; se errar as duas,
        o editor destrava do mesmo jeito, com a menor pontuação de localização.
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="font-mono font-semibold text-sucesso">cheio</dt><dd className="text-texto-apagado">acerto na 1ª</dd></div>
        <div><dt className="font-mono font-semibold text-destaque">−16%</dt><dd className="text-texto-apagado">acerto na 2ª</dd></div>
        <div><dt className="font-mono font-semibold text-perigo">−28%</dt><dd className="text-texto-apagado">errou as duas</dd></div>
      </dl>
    </section>
  );
}

// Dicas (S4-06, RF-12): travada com o motivo, disponível com o custo à vista antes
// de pedir, usada com o texto. Quem decide a liberação é o servidor (RN-04).
export function PainelDicas({ situacoes, textos, pedindo, aoPedir }: {
  situacoes: Record<NivelDica, SituacaoDica>; textos: Partial<Record<NivelDica, string>>;
  pedindo: NivelDica | null; aoPedir: (nivel: NivelDica) => void;
}) {
  const usadas = NIVEIS_DICA.filter((n) => situacoes[n].situacao === "usada").length;
  return (
    <section aria-label="Dicas" className="rounded border border-borda bg-painel p-8">
      <div className="flex justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-texto-secundario">DICAS</h2>
        <span className="text-sm text-texto-secundario">{usadas} de 3 usadas</span>
      </div>
      <ul className="mt-5 flex flex-col gap-4 text-sm">
        {NIVEIS_DICA.map((n) => {
          const s = situacoes[n];
          const titulo = `${n} · ${TITULO_DICA[n]}`;
          if (s.situacao === "usada") {
            return (
              <li key={n} className="rounded border border-destaque/40 bg-destaque/5 p-4">
                <div className="flex justify-between">
                  <span className="font-medium text-destaque">{titulo}</span>
                  <span className="font-mono text-texto-secundario">{CUSTO_DICA[n]} · usada</span>
                </div>
                <p className="mt-2 leading-6">{textos[n] ?? "Carregando o texto…"}</p>
              </li>
            );
          }
          if (s.situacao === "disponivel") {
            return (
              <li key={n}>
                <button type="button" onClick={() => aoPedir(n)} disabled={pedindo !== null}
                  className="flex w-full justify-between rounded border border-destaque px-4 py-3 text-left transition-colors enabled:hover:bg-destaque/10 disabled:opacity-60">
                  <span className="font-medium">{pedindo === n ? "Abrindo…" : `Abrir dica ${titulo}`}</span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-perigo">{CUSTO_DICA[n]} no PDR</span>
                </button>
              </li>
            );
          }
          return (
            <li key={n} className="text-texto-apagado">
              <div className="flex justify-between"><span>{titulo}</span><span className="font-mono">{CUSTO_DICA[n]} · travada</span></div>
              <p className="mt-1 text-xs">{s.motivo}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-xs leading-5 text-texto-apagado">O custo não soma: vale o da dica de maior nível que você abrir.</p>
    </section>
  );
}

export type EstadoBotaoPrecheck = { usados: number; limite: number; disponivel: boolean; preparando: boolean; executando: boolean };

export type EstadoBotaoVerificar = { disponivel: boolean; executando: boolean };

export function BarraAcoes({ editorTravado, precheck, aoPrecheck, verificar, aoVerificar, desistir, aoDesistir }: {
  editorTravado: boolean; precheck: EstadoBotaoPrecheck; aoPrecheck: () => void;
  verificar: EstadoBotaoVerificar; aoVerificar: () => void;
  desistir: { disponivel: boolean }; aoDesistir: () => void;
}) {
  // Desistir fica disponível desde o início, inclusive com o editor travado (D-17).
  // O contador mostra os usos consumidos: 3/3 quando esgota (RF-09).
  const rotulo = precheck.executando ? "Rodando…" : precheck.preparando && precheck.disponivel ? "Preparando o ambiente…" : "Precheck";
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={aoPrecheck} disabled={!precheck.disponivel || precheck.executando}
        aria-describedby="precheck-contador"
        className="h-14 whitespace-nowrap rounded border border-borda px-8 font-semibold transition-colors enabled:text-texto enabled:hover:border-texto-apagado disabled:text-texto-apagado">
        {rotulo} <span id="precheck-contador" className="font-mono text-sm font-normal text-texto-secundario">{precheck.usados}/{precheck.limite}</span>
      </button>
      <button type="button" onClick={aoVerificar} disabled={!verificar.disponivel || verificar.executando}
        className="h-14 whitespace-nowrap rounded border border-destaque bg-destaque px-8 font-semibold text-sobre-destaque transition-opacity enabled:hover:opacity-90 disabled:border-borda disabled:bg-transparent disabled:text-texto-apagado">
        {verificar.executando ? "Verificando…" : "Verificar"}
      </button>
      {editorTravado && <span className="text-sm text-texto-apagado">Disponíveis após você apontar a linha</span>}
      {!editorTravado && precheck.usados >= precheck.limite && <span className="text-sm text-texto-apagado">Os 3 Prechecks desta tentativa foram usados</span>}
      <button type="button" onClick={aoDesistir} disabled={!desistir.disponivel}
        className="ml-auto h-14 whitespace-nowrap rounded border border-borda px-6 font-semibold text-perigo transition-colors enabled:hover:border-perigo disabled:text-texto-apagado">
        Desistir e ver o feedback
      </button>
    </div>
  );
}

export function ResultadoDoPrecheck({ resultado, uso, limite, exercicio }: {
  resultado: ResultadoPrecheck; uso: number; limite: number; exercicio: Exercicio;
}) {
  const t = exercicio.teste_exemplo;
  const passou = resultado.resultado === "passou";
  const titulo = { passou: "Teste de exemplo passou", falhou: "Teste de exemplo falhou", erro: "O código lançou um erro", tempo_excedido: "Tempo excedido" }[resultado.resultado];
  return (
    <section aria-label="Resultado do Precheck" role="status"
      className={`rounded border ${passou ? "border-sucesso/40 bg-sucesso/5" : "border-perigo/40 bg-perigo/5"}`}>
      <header className={`flex items-center justify-between border-b px-6 py-3 ${passou ? "border-sucesso/30" : "border-perigo/30"}`}>
        <span className={`font-semibold ${passou ? "text-sucesso" : "text-perigo"}`}>{titulo}</span>
        <span className="text-sm text-texto-secundario">Precheck {uso} de {limite} · não altera a pontuação</span>
      </header>
      <div className="grid grid-cols-[auto_auto_1fr_1.4fr] gap-x-10 gap-y-1 px-6 py-4 text-sm">
        <span className="text-xs font-semibold tracking-wider text-texto-secundario">ENTRADA</span>
        <span className="text-xs font-semibold tracking-wider text-texto-secundario">ESPERADO</span>
        <span className="text-xs font-semibold tracking-wider text-texto-secundario">OBTIDO</span>
        <span className="text-xs font-semibold tracking-wider text-texto-secundario">ATENÇÃO</span>
        <code className="font-mono">{t.entrada_repr}</code>
        <code className="font-mono text-sucesso">{t.esperado_repr}</code>
        <code className={`font-mono break-all ${passou ? "text-sucesso" : "text-perigo"}`}>
          {resultado.resultado === "passou" || resultado.resultado === "falhou" ? resultado.obtido
            : resultado.resultado === "erro" ? resultado.erro : "passou de 2 segundos e foi interrompido"}
        </code>
        <p className="text-texto-secundario">O Precheck roda só este teste. O Verificar roda a suíte completa, com casos de borda.</p>
      </div>
    </section>
  );
}

// Resultado do Verificar (RF-10): quantos testes passaram do total, nunca o conteúdo
// dos testes (RN-03). Sem sucesso: −0,25 no reparo e dicas 2 e 3 liberáveis.
export function ResultadoDoVerificar({ resultado, numero, pdrFinal }: {
  resultado: ResultadoVerificacao; numero: number; pdrFinal: number | null;
}) {
  const passou = resultado.resultado === "passou";
  const titulo = passou ? "Todos os testes passaram"
    : resultado.resultado === "tempo_excedido" ? "Tempo excedido"
    : resultado.resultado === "erro" ? "O código lançou um erro" : "Algum teste falhou";
  const detalhe = passou
    ? "Exercício resolvido."
    : resultado.resultado === "tempo_excedido"
      ? "A suíte passou de 5 segundos e foi interrompida. Procure um laço que não termina."
      : resultado.resultado === "erro"
        ? "Em algum caso da suíte o código lançou uma exceção."
        : "O código devolveu um valor diferente do esperado em algum caso da suíte.";
  return (
    <section aria-label="Resultado do Verificar" role="status"
      className={`rounded border ${passou ? "border-sucesso/40 bg-sucesso/5" : "border-perigo/40 bg-perigo/5"}`}>
      <header className={`flex items-center justify-between border-b px-6 py-3 ${passou ? "border-sucesso/30" : "border-perigo/30"}`}>
        <span className={`font-semibold ${passou ? "text-sucesso" : "text-perigo"}`}>{titulo}</span>
        <span className="text-sm text-texto-secundario">Verificar {numero} · suíte completa</span>
      </header>
      <div className="flex items-center justify-between gap-6 px-6 py-4 text-sm">
        <p className="text-texto-secundario">
          {detalhe}
          {!passou && " O fator de reparo caiu 0,25, e as dicas 2 e 3 podem ser liberadas."}
        </p>
        <span className="shrink-0 font-mono">
          <span className={passou ? "text-sucesso" : "text-perigo"}>{resultado.passados}</span> de {resultado.total} testes
          {passou && pdrFinal !== null && <span className="ml-4 text-destaque">PDR final {pdrFinal}</span>}
        </span>
      </div>
    </section>
  );
}

// Confirmação da desistência (RF-13, RN-06): explícita e com a consequência à vista.
export function ConfirmarDesistencia({ enviando, aoConfirmar, aoCancelar }: {
  enviando: boolean; aoConfirmar: () => void; aoCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onKeyDown={(e) => e.key === "Escape" && !enviando && aoCancelar()}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="desistir-titulo" aria-describedby="desistir-texto"
        className="w-full max-w-lg rounded border border-perigo/50 bg-painel p-8">
        <h2 id="desistir-titulo" className="text-xl font-semibold">Desistir deste exercício?</h2>
        <div id="desistir-texto" className="mt-4 flex flex-col gap-2 text-sm leading-6 text-texto-secundario">
          <p>A tentativa é encerrada agora, com <strong className="text-perigo">PDR 0</strong>, e não pode ser retomada.</p>
          <p>Em seguida você vê o defeito, o código correto e a explicação. Refazer o exercício depois vale metade.</p>
        </div>
        <div className="mt-8 flex justify-end gap-4">
          <button type="button" onClick={aoCancelar} disabled={enviando} autoFocus
            className="h-12 rounded border border-borda px-6 font-semibold hover:border-texto-apagado">Continuar tentando</button>
          <button type="button" onClick={aoConfirmar} disabled={enviando}
            className="h-12 rounded border border-perigo bg-perigo/10 px-6 font-semibold text-perigo hover:bg-perigo/20 disabled:opacity-60">
            {enviando ? "Encerrando…" : "Desistir"}
          </button>
        </div>
      </section>
    </div>
  );
}

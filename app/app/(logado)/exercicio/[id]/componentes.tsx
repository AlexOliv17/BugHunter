// Blocos da tela do exercício (S3-01), conforme os protótipos ExercicioLocalizar e
// ExercicioPrecheck. Só apresentação: o estado vive em TelaExercicio.

import Link from "next/link";

import type { EstadoLocalizacao } from "@/lib/estado";
import type { RespostaTentativa } from "@/lib/tentativa";

type Exercicio = RespostaTentativa["exercicio"];

const nomeNivel = (nivel: string) => (nivel === "medio" ? "Médio" : "Baixo");

export function Caminho({ exercicio }: { exercicio: Exercicio }) {
  return (
    <nav aria-label="Caminho" className="text-sm text-texto-secundario">
      <Link href="/temas" className="hover:text-texto">Temas</Link>
      <span aria-hidden className="mx-2">/</span>
      <Link href={`/temas/${exercicio.tema}`} className="hover:text-texto">{nomeNivel(exercicio.nivel)}</Link>
      <span aria-hidden className="mx-2">/</span>
      <span className="text-texto">Exercício</span>
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

const EFEITO_LOCALIZACAO: Record<string, [string, string, string]> = {
  "1": ["Localização na 1ª", "cheio", "text-sucesso"],
  "0.6": ["Localização na 2ª", "−16%", "text-perigo"],
  "0.3": ["Localização não acertada", "−28%", "text-perigo"],
};

export function PainelPontuacao({ exercicio, multiplicadorRepeticao, localizacao }: {
  exercicio: Exercicio; multiplicadorRepeticao: number; localizacao?: EstadoLocalizacao;
}) {
  // O cálculo completo do PDR ao vivo, com reparo e dica, é a S4-03 e a S4-04 (RF-14).
  // Aqui só o efeito da localização (40% × fator, RN-05) e da repetição.
  const fator = localizacao?.fator ?? 1;
  const emJogo = Math.round(exercicio.base * (0.4 * fator + 0.6) * multiplicadorRepeticao);
  const efeito = localizacao?.fator != null ? EFEITO_LOCALIZACAO[String(localizacao.fator)] : null;
  return (
    <section aria-label="Pontuação" className="rounded border border-borda bg-painel p-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-texto-secundario">PDR EM JOGO</h2>
        <span className="text-5xl font-semibold text-destaque">{emJogo}</span>
      </div>
      <dl className="mt-6 flex flex-col gap-2 text-sm">
        <div className="flex justify-between"><dt className="text-texto-secundario">Base — {nomeNivel(exercicio.nivel).toLowerCase()}</dt><dd className="font-mono">{exercicio.base}</dd></div>
        {multiplicadorRepeticao < 1 && (
          <div className="flex justify-between"><dt className="text-texto-secundario">Repetição do exercício</dt><dd className="font-mono text-perigo">−50%</dd></div>
        )}
        {efeito && (
          <div className="flex justify-between"><dt className="text-texto-secundario">{efeito[0]}</dt><dd className={`font-mono ${efeito[2]}`}>{efeito[1]}</dd></div>
        )}
        {multiplicadorRepeticao === 1 && !efeito && (
          <div className="flex justify-between"><dt className="text-texto-apagado">Nenhuma penalidade ainda</dt><dd className="text-texto-apagado">—</dd></div>
        )}
      </dl>
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

const DICAS = [
  { nivel: 1, titulo: "Categoria do defeito", custo: "−15%" },
  { nivel: 2, titulo: "Região do código", custo: "−35%" },
  { nivel: 3, titulo: "Quase entrega", custo: "−60%" },
];

export function PainelDicas({ editorTravado }: { editorTravado: boolean }) {
  // Estados completos (disponível, usada com texto) e o pedido ao servidor: S4-05 e S4-06 (RF-12).
  return (
    <section aria-label="Dicas" className="rounded border border-borda bg-painel p-8">
      <div className="flex justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-texto-secundario">DICAS</h2>
        <span className="text-sm text-texto-secundario">0 de 3 usadas</span>
      </div>
      <ul className="mt-5 flex flex-col gap-3 text-sm">
        {DICAS.map((d) => (
          <li key={d.nivel} className="flex justify-between text-texto-apagado">
            <span>{d.nivel} · {d.titulo}</span>
            <span className="font-mono">{d.custo} · travada</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm text-texto-secundario">
        {editorTravado ? "As dicas abrem depois que você apontar a linha." : "As dicas 2 e 3 abrem depois de um Verificar falho."}
      </p>
    </section>
  );
}

export function BarraAcoes({ editorTravado }: { editorTravado: boolean }) {
  // Precheck: S3-06. Verificar: S4-02. Desistir (disponível desde o início, D-17): S5-06.
  return (
    <div className="flex items-center gap-4">
      <button type="button" disabled className="h-14 rounded border border-borda px-8 font-semibold text-texto-apagado">
        Precheck <span className="font-mono text-sm font-normal">0/3</span>
      </button>
      <button type="button" disabled className="h-14 rounded border border-borda px-8 font-semibold text-texto-apagado">Verificar</button>
      {editorTravado && <span className="text-sm text-texto-apagado">Disponíveis após você apontar a linha</span>}
      <button type="button" disabled className="ml-auto h-14 rounded border border-borda px-6 font-semibold text-perigo/60">
        Desistir e ver o feedback
      </button>
    </div>
  );
}

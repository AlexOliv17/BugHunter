// Pontuação da tentativa (RN-05, RF-14). Pura: mesmos argumentos, mesmo resultado,
// sem consultar o banco, para que o histórico possa ser recalculado.
//
//   PDR = base × (0,4 × fator_localização + 0,6 × fator_reparo)
//              × multiplicador_dica × multiplicador_repeticao
//
// A conta é feita em inteiros (fatores em centésimos), para que o empate 42,5 → 43
// (D-16, meio-para-cima) não dependa de erro de ponto flutuante.

import { estadoLocalizacao, FATOR_LOCALIZACAO, type EstadoTentativa, type Evento, type TentativaLocalizacao } from "./estado";

export const PESO_LOCALIZACAO = 0.4;
export const PESO_REPARO = 0.6;
export const PENALIDADE_VERIFICAR = 0.25;                                          // RN-03, D-09
export const MULTIPLICADOR_DICA = { 0: 1.0, 1: 0.85, 2: 0.65, 3: 0.4 } as const;   // RN-04
export const MULTIPLICADOR_REPETICAO = { primeira: 1.0, repeticao: 0.5 } as const; // RN-07

export type ComponentesPdr = {
  base: number;
  fatorLocalizacao: number;        // 1,0 · 0,6 · 0,3 (também 0,3 se não concluída, D-17)
  fatorReparo: number;             // 1,0 − 0,25 por Verificar sem sucesso, piso 0
  multiplicadorDica: number;       // do maior nível de dica usado
  multiplicadorRepeticao: number;  // 1,0 na primeira tentativa, 0,5 depois
  desistiu: boolean;               // RN-06: PDR 0
  treino: boolean;                 // D-31: exercício já resolvido antes; PDR 0
};

// treino: repetição de um exercício já resolvido (D-31); a nota é a da 1ª resolvida
export type OpcoesPdr = { base: number; numero_tentativa: number; treino?: boolean };

const centesimos = (x: number) => Math.round(x * 100);

export function componentesPdr(eventos: Evento[], { base, numero_tentativa, treino = false }: OpcoesPdr): ComponentesPdr {
  const localizacoes: TentativaLocalizacao[] = [];
  let falhas = 0, maiorDica = 0, desistiu = false;
  for (const e of eventos) {
    if (e.tipo === "localizou" && localizacoes.length < 2 && !localizacoes.some((t) => t.correta)) {
      localizacoes.push({ linha: Number(e.payload.linha), correta: e.payload.correta === true });
    } else if (e.tipo === "verificar" && e.payload.resultado !== "passou") {
      falhas += 1;
    } else if (e.tipo === "dica") {
      const nivel = Number(e.payload.nivel);
      if (nivel === 1 || nivel === 2 || nivel === 3) maiorDica = Math.max(maiorDica, nivel);
    } else if (e.tipo === "encerrou" && e.payload.desfecho === "desistiu") {
      desistiu = true;
    }
  }
  return {
    base,
    fatorLocalizacao: estadoLocalizacao(localizacoes).fator ?? FATOR_LOCALIZACAO.naoLocalizou,
    fatorReparo: Math.max(0, 1 - PENALIDADE_VERIFICAR * falhas),
    multiplicadorDica: MULTIPLICADOR_DICA[maiorDica as 0 | 1 | 2 | 3],
    multiplicadorRepeticao: numero_tentativa > 1 ? MULTIPLICADOR_REPETICAO.repeticao : MULTIPLICADOR_REPETICAO.primeira,
    desistiu,
    treino,
  };
}

// Valor com os componentes dados, arredondado meio-para-cima (D-16).
export function pdrDosComponentes(c: ComponentesPdr): number {
  if (c.desistiu || c.treino) return 0;
  const numerador = c.base
    * (centesimos(PESO_LOCALIZACAO) * centesimos(c.fatorLocalizacao) + centesimos(PESO_REPARO) * centesimos(c.fatorReparo))
    * centesimos(c.multiplicadorDica) * centesimos(c.multiplicadorRepeticao);
  const denominador = 100 ** 4;
  return Math.floor((2 * numerador + denominador) / (2 * denominador));
}

export function calcularPdr(eventos: Evento[], opcoes: OpcoesPdr): number {
  return pdrDosComponentes(componentesPdr(eventos, opcoes));
}

// Painel ao vivo (S4-04, RF-14): a mesma conta, sobre o estado da tentativa.
// Aberta: o máximo ainda possível, supondo que o próximo passo dê certo
// (acertar a linha, se a localização não terminou; passar no próximo Verificar).
// Encerrada: o PDR final, igual ao que o servidor gravou.
export function pdrDoEstado(estado: EstadoTentativa, opcoes: OpcoesPdr) {
  const eventos: Evento[] = estado.localizacao.tentativas.map((t) => ({ tipo: "localizou", payload: { ...t } }));
  if (!estado.localizacao.concluida && !estado.encerrada) eventos.push({ tipo: "localizou", payload: { correta: true } });
  for (const v of estado.verificacoes) eventos.push({ tipo: "verificar", payload: { ...v } });
  for (const nivel of estado.dicasUsadas) eventos.push({ tipo: "dica", payload: { nivel } });
  if (estado.encerrada) eventos.push({ tipo: "encerrou", payload: { ...estado.encerrada } });
  const componentes = componentesPdr(eventos, opcoes);
  return { componentes, pdr: pdrDosComponentes(componentes), final: estado.encerrada !== null };
}

// Dicas graduadas (RF-12, RN-04). Puras. A condição de liberação vale no servidor
// (solicitar_dica, migration 012); aqui ela é espelhada só para a tela mostrar o
// estado de cada dica e o motivo antes de o aluno pedir (D-08).

import type { EstadoTentativa } from "./estado";

export const NIVEIS_DICA = [1, 2, 3] as const;
export type NivelDica = (typeof NIVEIS_DICA)[number];

export const TITULO_DICA: Record<NivelDica, string> = { 1: "Categoria do defeito", 2: "Região do código", 3: "Quase entrega" };
export const CUSTO_DICA: Record<NivelDica, string> = { 1: "−15%", 2: "−35%", 3: "−60%" };

export const MOTIVO_TRAVADA: Record<NivelDica, string> = {
  1: "A dica 1 abre depois que você apontar a linha do defeito.",
  2: "A dica 2 abre depois da dica 1 e de um Verificar sem sucesso.",
  3: "A dica 3 abre depois da dica 2.",
};

export const ehNivelDica = (x: unknown): x is NivelDica => x === 1 || x === 2 || x === 3;

export type SituacaoDica =
  | { situacao: "usada" }
  | { situacao: "disponivel" }
  | { situacao: "travada"; motivo: string };

export function situacaoDasDicas(estado: EstadoTentativa): Record<NivelDica, SituacaoDica> {
  const usadas = new Set(estado.dicasUsadas);
  const falhou = estado.verificacoes.some((v) => v.resultado !== "passou");
  const liberada: Record<NivelDica, boolean> = {
    1: estado.editorLiberado,
    2: usadas.has(1) && falhou,
    3: usadas.has(2),
  };
  const situacao = (n: NivelDica): SituacaoDica => {
    if (usadas.has(n)) return { situacao: "usada" };
    if (estado.encerrada) return { situacao: "travada", motivo: "A tentativa foi encerrada." };
    return liberada[n] ? { situacao: "disponivel" } : { situacao: "travada", motivo: MOTIVO_TRAVADA[n] };
  };
  return { 1: situacao(1), 2: situacao(2), 3: situacao(3) };
}

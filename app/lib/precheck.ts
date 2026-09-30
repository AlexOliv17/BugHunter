// Regras do Precheck (RN-02, RF-09, D-10). Puras.

export const LIMITE_USOS = 3;
export const LIMITE_MS = 2000;

export type ResultadoPrecheck =
  | { resultado: "passou"; obtido: string }
  | { resultado: "falhou"; obtido: string }
  | { resultado: "erro"; erro: string }
  | { resultado: "tempo_excedido" };

// Uso consumido: toda execução que chegou a rodar, inclusive a que estourou o
// tempo (D-10). Clicar com o ambiente ainda carregando não consome (decisão 1.7).
export const usosRestantes = (usados: number) => Math.max(0, LIMITE_USOS - usados);
export const precheckDisponivel = (usados: number, editorLiberado: boolean) => editorLiberado && usados < LIMITE_USOS;

// Nome da função a partir da assinatura, ex. "media_das_notas(notas)" -> "media_das_notas".
export function nomeDaFuncao(assinatura: string): string {
  return assinatura.slice(0, assinatura.indexOf("(")).trim();
}

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

// O que é gravado no evento precheck (S3-07): em erro, a mensagem vai no campo obtido.
export function obtidoDoResultado(r: ResultadoPrecheck): string | null {
  if (r.resultado === "passou" || r.resultado === "falhou") return r.obtido;
  if (r.resultado === "erro") return r.erro;
  return null;
}

// Caminho inverso, para mostrar o último Precheck ao retomar a tentativa (RN-10).
export function resultadoDoUso(uso: { resultado: string; obtido: string | null }): ResultadoPrecheck {
  switch (uso.resultado) {
    case "passou":
    case "falhou":
      return { resultado: uso.resultado, obtido: uso.obtido ?? "" };
    case "erro":
      return { resultado: "erro", erro: uso.obtido ?? "" };
    default:
      return { resultado: "tempo_excedido" };
  }
}

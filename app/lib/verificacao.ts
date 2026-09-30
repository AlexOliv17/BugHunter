// Resultado do Verificar (RN-03, RF-10) a partir da resposta do executor. Pura.
// O executor devolve só os valores obtidos; a comparação com o esperado é feita
// aqui (D-26), com a regra da D-27.

import { deFio, iguais, type CasoOculto } from "./valor";

export type ResultadoVerificar = { resultado: "passou" | "falhou" | "tempo_excedido" | "erro"; passados: number; total: number };

export type RespostaExecutor = {
  situacao: "ok" | "tempo_excedido" | "erro";
  resultados: ({ valor: unknown } | { erro: string })[];
};

export class RespostaExecutorInvalida extends Error {}

export function lerRespostaExecutor(corpo: unknown, total: number): RespostaExecutor {
  const r = corpo as Partial<RespostaExecutor> | null;
  if (!r || !["ok", "tempo_excedido", "erro"].includes(r.situacao as string) || !Array.isArray(r.resultados)) {
    throw new RespostaExecutorInvalida("resposta fora do formato");
  }
  if (!r.resultados.every((x) => typeof x === "object" && x !== null && ("valor" in x || typeof (x as { erro?: unknown }).erro === "string"))) {
    throw new RespostaExecutorInvalida("resultado fora do formato");
  }
  if (r.situacao === "ok" && r.resultados.length !== total) throw new RespostaExecutorInvalida("número de resultados diferente do de casos");
  return r as RespostaExecutor;
}

// Tempo excedido e erro ao carregar o código: nenhum caso conta como passado.
// Exceção num caso: o caso falha e o Verificar é classificado como "erro" (RF-10:
// "lança exceção"), mesmo que outros casos tenham só dado valor errado.
export function avaliar(casos: CasoOculto[], resposta: RespostaExecutor): ResultadoVerificar {
  const total = casos.length;
  if (resposta.situacao !== "ok") return { resultado: resposta.situacao, passados: 0, total };
  let passados = 0, excecao = false;
  resposta.resultados.forEach((r, i) => {
    if ("erro" in r) {
      excecao = true;
      return;
    }
    try {
      if (iguais(deFio(r.valor), casos[i].esperado)) passados += 1;
    } catch {
      // valor fora do formato: o caso falha
    }
  });
  if (passados === total) return { resultado: "passou", passados, total };
  return { resultado: excecao ? "erro" : "falhou", passados, total };
}

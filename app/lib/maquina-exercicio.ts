// Máquina de estados da tela do exercício (S3-04, RF-07, RN-01): travado → liberado.
// Redutor puro. As transições só acontecem com respostas do servidor, que é quem
// compara a linha e grava os eventos; o navegador nunca decide que acertou.

import { estadoLocalizacao, type EstadoTentativa } from "./estado";

export type Acao =
  | { tipo: "carregou"; estado: EstadoTentativa }
  | { tipo: "localizou"; linha: number; correta: boolean };

export function reduzir(estado: EstadoTentativa, acao: Acao): EstadoTentativa {
  switch (acao.tipo) {
    case "carregou":
      return acao.estado;
    case "localizou": {
      if (estado.localizacao.concluida) return estado;
      const localizacao = estadoLocalizacao([...estado.localizacao.tentativas, { linha: acao.linha, correta: acao.correta }]);
      // RN-01: acerto destrava; o segundo erro também destrava, automaticamente
      return { ...estado, localizacao, editorLiberado: localizacao.concluida };
    }
  }
}

// Máquina de estados da tela do exercício (S3-04, RF-07, RN-01): travado → liberado.
// Redutor puro. As transições só acontecem com respostas do servidor, que é quem
// compara a linha e grava os eventos; o navegador nunca decide que acertou.

import { estadoLocalizacao, type EstadoTentativa, type ResultadoVerificacao, type UsoPrecheck } from "./estado";

export type Acao =
  | { tipo: "carregou"; estado: EstadoTentativa }
  | { tipo: "localizou"; linha: number; correta: boolean }
  | { tipo: "editou"; codigo: string }
  | { tipo: "precheck"; uso: UsoPrecheck }
  | { tipo: "verificou"; resultado: ResultadoVerificacao; encerrada: boolean }
  | { tipo: "dica"; nivel: number };

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
    case "editou":
      return { ...estado, codigoAtual: acao.codigo };
    case "precheck":
      // o número do uso vem do servidor, que recusa o quarto (RN-02)
      return { ...estado, prechecks: { usados: acao.uso.numero_uso, ultimo: acao.uso } };
    case "dica":
      // o servidor já verificou a liberação e gravou o evento (RN-04)
      if (estado.dicasUsadas.includes(acao.nivel)) return estado;
      return { ...estado, dicasUsadas: [...estado.dicasUsadas, acao.nivel] };
    case "verificou":
      // resultado e encerramento vêm do servidor, que é quem roda e compara (RN-03)
      if (estado.encerrada) return estado;
      return {
        ...estado,
        verificacoes: [...estado.verificacoes, acao.resultado],
        encerrada: acao.encerrada ? { desfecho: "resolvido" } : null,
      };
  }
}

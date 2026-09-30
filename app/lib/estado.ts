// Estado de uma tentativa reconstruído a partir dos eventos (RN-10, RF-17, DA-06).
// Função pura: a mesma lista de eventos dá sempre o mesmo estado.

export type Evento = { tipo: string; payload: Record<string, unknown> };

export type TentativaLocalizacao = { linha: number; correta: boolean };

// RN-01: acerto na 1ª = 1,0; erro e acerto = 0,6; dois erros = 0,3.
// Localização não concluída (desistência antes) também conta 0,3 no cálculo (D-17).
export const FATOR_LOCALIZACAO = { primeira: 1.0, segunda: 0.6, naoLocalizou: 0.3 } as const;

export type EstadoLocalizacao = {
  tentativas: TentativaLocalizacao[];
  concluida: boolean;
  acertou: boolean;
  fator: number | null;          // null enquanto não concluída
};

export type EstadoTentativa = {
  localizacao: EstadoLocalizacao;
  editorLiberado: boolean;
};

export function estadoLocalizacao(tentativas: TentativaLocalizacao[]): EstadoLocalizacao {
  const acertou = tentativas.some((t) => t.correta);
  const concluida = acertou || tentativas.length >= 2;
  let fator: number | null = null;
  if (concluida) {
    if (tentativas[0]?.correta) fator = FATOR_LOCALIZACAO.primeira;
    else if (acertou) fator = FATOR_LOCALIZACAO.segunda;
    else fator = FATOR_LOCALIZACAO.naoLocalizou;
  }
  return { tentativas, concluida, acertou, fator };
}

export function reconstruirEstado(eventos: Evento[]): EstadoTentativa {
  const tentativas: TentativaLocalizacao[] = [];
  for (const e of eventos) {
    if (e.tipo === "localizou" && tentativas.length < 2 && !tentativas.some((t) => t.correta)) {
      tentativas.push({ linha: Number(e.payload.linha), correta: e.payload.correta === true });
    }
  }
  const localizacao = estadoLocalizacao(tentativas);
  return { localizacao, editorLiberado: localizacao.concluida };
}

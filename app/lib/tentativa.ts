// POST /api/tentativa (RF-05, D-20): pedido e resposta. Funções puras.

import type { EstadoTentativa } from "./estado";
import { BASE_POR_NIVEL, ehNivel, type Nivel } from "./niveis";

export type PedidoTentativa =
  | { tipo: "abrir"; tema: string; nivel: Nivel }      // Começar: RN-09
  | { tipo: "retomar"; tentativaId: string };           // recarregar a tela do exercício

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerPedido(corpo: unknown): PedidoTentativa | null {
  if (typeof corpo !== "object" || corpo === null) return null;
  const c = corpo as Record<string, unknown>;
  if (typeof c.tentativa_id === "string" && UUID.test(c.tentativa_id)) return { tipo: "retomar", tentativaId: c.tentativa_id };
  if (typeof c.tema === "string" && /^[a-z0-9_]{1,40}$/.test(c.tema) && ehNivel(c.nivel)) {
    return { tipo: "abrir", tema: c.tema, nivel: c.nivel };
  }
  return null;
}

export type TesteExemplo = { chamada: string; entrada: unknown[]; esperado: unknown; entrada_repr: string; esperado_repr: string };

export type LinhaExercicio = {
  tentativa_id: string; numero_tentativa: number; desfecho: string;
  codigo_com_defeito: string; assinatura: string; descricao: string;
  teste_exemplo: TesteExemplo;
  tema_codigo: string; nivel: string;
};

export type RespostaTentativa = {
  tentativa: { id: string; numero: number; multiplicador_repeticao: number };
  estado: EstadoTentativa;
  exercicio: {
    assinatura: string; descricao: string; codigo: string;
    teste_exemplo: TesteExemplo;
    tema: string; nivel: Nivel; base: number;
  };
};

// Lista fechada do que vai ao navegador: nunca suite_oculta, codigo_correto,
// linha_defeito nem categoria_codigo (RNF-03), mesmo que a linha traga mais campos.
export function montarResposta(l: LinhaExercicio, estado: EstadoTentativa): RespostaTentativa {
  const nivel = ehNivel(l.nivel) ? l.nivel : "baixo";
  return {
    tentativa: { id: l.tentativa_id, numero: l.numero_tentativa, multiplicador_repeticao: l.numero_tentativa > 1 ? 0.5 : 1 },
    estado,
    exercicio: {
      assinatura: l.assinatura,
      descricao: l.descricao,
      codigo: l.codigo_com_defeito,
      teste_exemplo: {
        chamada: l.teste_exemplo.chamada, entrada: l.teste_exemplo.entrada, esperado: l.teste_exemplo.esperado,
        entrada_repr: l.teste_exemplo.entrada_repr, esperado_repr: l.teste_exemplo.esperado_repr,
      },
      tema: l.tema_codigo,
      nivel,
      base: BASE_POR_NIVEL[nivel],
    },
  };
}

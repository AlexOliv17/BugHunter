import "server-only";

// Feedback de uma tentativa encerrada (RF-15, S5-02 e S5-03). Chamado logo depois do
// encerramento (after(), em /api/verificar e /api/encerrar) e, se ainda faltar, pela
// tela final. Gera uma vez: o texto gravado primeiro fica (gravar_feedback).
// Falha ou estouro de 15 s no modelo: grava a reserva, sem bloquear nada.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Evento } from "./estado";
import { entradaDoModelo, feedbackDeReserva, normalizarFeedback, type DadosEncerramento } from "./feedback";
import { gerarTexto } from "./modelo";

export async function lerEncerramento(banco: SupabaseClient, usuarioId: string, tentativaId: string) {
  const { data, error } = await banco.rpc("dados_do_encerramento", { p_usuario: usuarioId, p_tentativa: tentativaId });
  if (error) return { erro: error.code ?? "?" } as const;
  const dados = (data as DadosEncerramento[] | null)?.[0];
  if (!dados) return { erro: "BH001" } as const;
  return { dados } as const;
}

export async function lerEventos(banco: SupabaseClient, tentativaId: string): Promise<(Evento & { em: string })[] | null> {
  const { data, error } = await banco
    .from("eventos").select("tipo, payload, em").eq("tentativa_id", tentativaId).order("em").order("id");
  return error ? null : (data as (Evento & { em: string })[]);
}

export async function garantirFeedback(banco: SupabaseClient, usuarioId: string, tentativaId: string): Promise<string | null> {
  const lido = await lerEncerramento(banco, usuarioId, tentativaId);
  if ("erro" in lido) return null;
  if (lido.dados.feedback_texto) return lido.dados.feedback_texto;

  const eventos = await lerEventos(banco, tentativaId);
  let texto: string | null = null;
  if (eventos) {
    try {
      texto = normalizarFeedback(await gerarTexto(entradaDoModelo(lido.dados, eventos)));
    } catch (e) {
      console.error("feedback:", (e as Error).message);
    }
  }
  const { data, error } = await banco.rpc("gravar_feedback", {
    p_tentativa: tentativaId, p_texto: texto ?? feedbackDeReserva(lido.dados),
  });
  if (error) {
    console.error("feedback: gravar", error.code);
    return null;
  }
  return data as string;
}

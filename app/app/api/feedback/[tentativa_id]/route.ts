// /api/feedback/[tentativa_id] — tela final (RF-15). Só de tentativa encerrada do
// próprio aluno (dados_do_encerramento).
//   GET  dados da tela: desfecho, PDR, estado reconstruído (para discriminar a
//        pontuação), linha do tempo, código plantado e submetido, categoria e o
//        feedback, se já gravado. Responde na hora.
//   POST garante o feedback: se ainda não foi gravado (o after() do encerramento
//        falhou ou ainda corre), gera agora, uma vez, e devolve o texto.
// O código correto e a linha do defeito vêm de /api/gabarito.

import { erroDoBanco, respostaErro, UUID } from "@/lib/api";
import { garantirFeedback, lerEncerramento, lerEventos } from "@/lib/encerramento";
import { reconstruirEstado } from "@/lib/estado";
import { codigoSubmetido, linhaDoTempo } from "@/lib/feedback";
import { BASE_POR_NIVEL, ehNivel } from "@/lib/niveis";
import { usuarioAtual } from "@/lib/sessao";
import { criarClienteServico } from "@/lib/supabase/servico";

export const maxDuration = 30;

const falha = "Não foi possível carregar o resultado agora.";

async function pedido(ctx: RouteContext<"/api/feedback/[tentativa_id]">) {
  const usuario = await usuarioAtual();
  if (!usuario) return { erro: respostaErro(401, "Entre para continuar.") } as const;
  const { tentativa_id } = await ctx.params;
  if (!UUID.test(tentativa_id)) return { erro: respostaErro(400, "Pedido inválido.") } as const;
  return { usuario, tentativaId: tentativa_id, banco: criarClienteServico() } as const;
}

export async function GET(_request: Request, ctx: RouteContext<"/api/feedback/[tentativa_id]">) {
  const p = await pedido(ctx);
  if ("erro" in p) return p.erro;
  const lido = await lerEncerramento(p.banco, p.usuario.id, p.tentativaId);
  if ("erro" in lido) return erroDoBanco(lido.erro, falha);
  const eventos = await lerEventos(p.banco, p.tentativaId);
  if (!eventos) return respostaErro(500, falha);

  const d = lido.dados;
  const nivel = ehNivel(d.nivel) ? d.nivel : "baixo";
  return Response.json({
    desfecho: d.desfecho, pdr_final: d.pdr_final, numero_tentativa: d.numero_tentativa,
    treino: d.treino, ja_resolvido: d.ja_resolvido,
    exercicio: { assinatura: d.assinatura, descricao: d.descricao, tema: d.tema_codigo, nivel, base: BASE_POR_NIVEL[nivel] },
    categoria: d.categoria_nome,
    estado: reconstruirEstado(eventos),
    linha_do_tempo: linhaDoTempo(eventos),
    codigo_com_defeito: d.codigo_com_defeito,
    codigo_submetido: codigoSubmetido(eventos, d),
    feedback: d.feedback_texto,
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(_request: Request, ctx: RouteContext<"/api/feedback/[tentativa_id]">) {
  const p = await pedido(ctx);
  if ("erro" in p) return p.erro;
  const texto = await garantirFeedback(p.banco, p.usuario.id, p.tentativaId);
  if (texto === null) return respostaErro(500, "Não foi possível gerar o feedback agora.");
  return Response.json({ feedback: texto }, { headers: { "cache-control": "no-store" } });
}

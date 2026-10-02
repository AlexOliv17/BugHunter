// POST /api/tentativa — inicia ou retoma a tentativa (RF-05, RN-09, RN-10, RN-11).
// Corpo: { tema, nivel } para Começar, ou { tentativa_id } para retomar uma aberta.
// Devolve só o exercício da tentativa aberta do próprio aluno (D-20).

import { reconstruirEstado, type Evento } from "@/lib/estado";
import { usuarioAtual } from "@/lib/sessao";
import { criarClienteServico } from "@/lib/supabase/servico";
import { lerPedido, montarResposta, type DicaAberta, type LinhaExercicio } from "@/lib/tentativa";

const erro = (status: number, mensagem: string) => Response.json({ erro: mensagem }, { status });

export async function POST(request: Request) {
  const usuario = await usuarioAtual();
  if (!usuario) return erro(401, "Entre para continuar.");

  const pedido = lerPedido(await request.json().catch(() => null));
  if (!pedido) return erro(400, "Pedido inválido.");

  const banco = criarClienteServico();
  let tentativaId: string;
  if (pedido.tipo === "abrir") {
    const { data, error } = await banco.rpc("abrir_tentativa", { p_usuario: usuario.id, p_tema: pedido.tema, p_nivel: pedido.nivel });
    if (error?.code === "P0002") return erro(404, "Ainda não há exercícios neste nível.");
    if (error || !data) return erro(500, "Não foi possível abrir o exercício agora.");
    tentativaId = data as string;
  } else {
    tentativaId = pedido.tentativaId;
  }

  const { data: linhas, error } = await banco.rpc("exercicio_da_tentativa", { p_usuario: usuario.id, p_tentativa: tentativaId });
  if (error) return erro(500, "Não foi possível carregar o exercício agora.");
  const linha = (linhas as LinhaExercicio[] | null)?.[0];
  // tentativa inexistente ou de outro aluno: mesma resposta, para não revelar qual (RNF-04)
  if (!linha) return erro(404, "Tentativa não encontrada.");
  // encerrada: a tela leva ao resultado (RF-13, RF-15)
  if (linha.desfecho !== "aberto") {
    return Response.json({ erro: "Esta tentativa já foi encerrada.", encerrada: true }, { status: 409 });
  }

  // RN-10: a tentativa volta no estado reconstruído a partir dos eventos
  const { data: eventos, error: erroEventos } = await banco
    .from("eventos").select("tipo, payload").eq("tentativa_id", tentativaId).order("em").order("id");
  if (erroEventos) return erro(500, "Não foi possível carregar o exercício agora.");
  // textos das dicas já abertas, para mostrá-las de novo (RF-12)
  const { data: dicas, error: erroDicas } = await banco.rpc("dicas_da_tentativa", { p_usuario: usuario.id, p_tentativa: tentativaId });
  if (erroDicas) return erro(500, "Não foi possível carregar o exercício agora.");

  return Response.json(montarResposta(linha, reconstruirEstado(eventos as Evento[]), (dicas as DicaAberta[] | null) ?? []),
    { headers: { "cache-control": "no-store" } });
}

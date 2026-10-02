// POST /api/refazer — nova tentativa do mesmo exercício (RF-16, RN-07, RN-11).
// Corpo: { tentativa_id } de uma tentativa encerrada do aluno. Devolve o id da nova
// (ou da que já estiver aberta para esse exercício). Vale metade: numero_tentativa > 1.

import { erroDoBanco, lerPedidoDaTentativa } from "@/lib/api";
import { criarClienteServico } from "@/lib/supabase/servico";

export async function POST(request: Request) {
  const pedido = await lerPedidoDaTentativa(request);
  if ("erro" in pedido) return pedido.erro;
  const { data, error } = await criarClienteServico().rpc("refazer_exercicio", {
    p_usuario: pedido.usuario.id, p_tentativa: pedido.tentativaId,
  });
  if (error || !data) return erroDoBanco(error?.code, "Não foi possível abrir o exercício de novo agora.");
  return Response.json({ tentativa_id: data as string }, { headers: { "cache-control": "no-store" } });
}

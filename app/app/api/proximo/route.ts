// POST /api/proximo — "Próximo exercício" da tela final (D-29).
// Corpo: { tentativa_id } de uma tentativa encerrada do aluno. Devolve a tentativa
// do próximo exercício do mesmo tema e nível (RN-09 sem o exercício atual).

import { erroDoBanco, lerPedidoDaTentativa } from "@/lib/api";
import { criarClienteServico } from "@/lib/supabase/servico";

export async function POST(request: Request) {
  const pedido = await lerPedidoDaTentativa(request);
  if ("erro" in pedido) return pedido.erro;
  const { data, error } = await criarClienteServico().rpc("abrir_proximo", {
    p_usuario: pedido.usuario.id, p_tentativa: pedido.tentativaId,
  });
  if (error || !data) return erroDoBanco(error?.code, "Não foi possível abrir o próximo exercício agora.");
  return Response.json({ tentativa_id: data as string }, { headers: { "cache-control": "no-store" } });
}

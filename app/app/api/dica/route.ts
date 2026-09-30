// POST /api/dica — devolve o texto de uma dica, se liberada (RF-12, RN-04).
// Corpo: { tentativa_id, nivel }. A condição de liberação é verificada no banco
// antes de qualquer texto sair, e o evento dica é gravado lá (solicitar_dica).
// Pedir de novo uma dica já usada devolve o mesmo texto, sem novo custo.

import { erroDoBanco, lerPedidoDaTentativa, respostaErro } from "@/lib/api";
import { ehNivelDica, MOTIVO_TRAVADA } from "@/lib/dicas";
import { criarClienteServico } from "@/lib/supabase/servico";

export async function POST(request: Request) {
  const pedido = await lerPedidoDaTentativa(request);
  if ("erro" in pedido) return pedido.erro;
  const nivel = pedido.corpo.nivel;
  if (!ehNivelDica(nivel)) return respostaErro(400, "Pedido inválido.");

  const { data, error } = await criarClienteServico().rpc("solicitar_dica", {
    p_usuario: pedido.usuario.id, p_tentativa: pedido.tentativaId, p_nivel: nivel,
  });
  if (error?.code === "BH009") return respostaErro(409, MOTIVO_TRAVADA[nivel]);
  if (error) return erroDoBanco(error.code, "Não foi possível abrir a dica agora.");
  return Response.json({ nivel, texto: data as string }, { headers: { "cache-control": "no-store" } });
}

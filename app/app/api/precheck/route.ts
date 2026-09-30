// POST /api/precheck — registra o resultado do Precheck rodado no navegador (RF-09, DA-03).
// Corpo: { tentativa_id, resultado, obtido }. numero_uso é atribuído no banco, que
// recusa o quarto uso (RN-02). O Precheck não altera a pontuação.

import { erroDoBanco, lerPedidoDaTentativa, respostaErro } from "@/lib/api";
import { criarClienteServico } from "@/lib/supabase/servico";

const RESULTADOS = new Set(["passou", "falhou", "tempo_excedido", "erro"]);

export async function POST(request: Request) {
  const pedido = await lerPedidoDaTentativa(request);
  if ("erro" in pedido) return pedido.erro;
  const { resultado, obtido } = pedido.corpo;
  if (typeof resultado !== "string" || !RESULTADOS.has(resultado)) return respostaErro(400, "Pedido inválido.");
  const obtidoTexto = typeof obtido === "string" ? obtido.slice(0, 500) : null;

  const { data, error } = await criarClienteServico().rpc("registrar_precheck", {
    p_usuario: pedido.usuario.id, p_tentativa: pedido.tentativaId, p_resultado: resultado, p_obtido: obtidoTexto,
  });
  if (error) return erroDoBanco(error.code, "Não foi possível registrar o Precheck agora.");
  return Response.json({ numero_uso: data as number }, { headers: { "cache-control": "no-store" } });
}

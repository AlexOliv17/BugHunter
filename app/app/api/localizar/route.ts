// POST /api/localizar — registra a linha apontada (RF-07, RN-01).
// Corpo: { tentativa_id, linha }. A comparação com linha_defeito é feita no banco;
// a resposta diz só se estava correta e se a localização terminou (RNF-03).

import { erroDoBanco, lerPedidoDaTentativa, respostaErro } from "@/lib/api";
import { criarClienteServico } from "@/lib/supabase/servico";

export async function POST(request: Request) {
  const pedido = await lerPedidoDaTentativa(request);
  if ("erro" in pedido) return pedido.erro;
  const linha = pedido.corpo.linha;
  if (!Number.isInteger(linha)) return respostaErro(400, "Pedido inválido.");

  const { data, error } = await criarClienteServico().rpc("registrar_localizacao", {
    p_usuario: pedido.usuario.id, p_tentativa: pedido.tentativaId, p_linha: linha,
  });
  if (error) return erroDoBanco(error.code, "Não foi possível registrar a linha agora.");
  const r = (data as { correta: boolean; tentativa_num: number; concluida: boolean }[])[0];
  return Response.json({ correta: r.correta, tentativa: r.tentativa_num, concluida: r.concluida }, { headers: { "cache-control": "no-store" } });
}

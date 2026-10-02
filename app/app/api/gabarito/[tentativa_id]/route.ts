// GET /api/gabarito/[tentativa_id] — o código correto e a linha do defeito (RF-15).
// Duas condições, verificadas no banco (dados_do_encerramento): a tentativa é do
// solicitante e já foi encerrada. Antes disso, nada sai (RNF-03).

import { erroDoBanco, respostaErro, UUID } from "@/lib/api";
import { lerEncerramento } from "@/lib/encerramento";
import { usuarioAtual } from "@/lib/sessao";
import { criarClienteServico } from "@/lib/supabase/servico";

export async function GET(_request: Request, ctx: RouteContext<"/api/gabarito/[tentativa_id]">) {
  const usuario = await usuarioAtual();
  if (!usuario) return respostaErro(401, "Entre para continuar.");
  const { tentativa_id } = await ctx.params;
  if (!UUID.test(tentativa_id)) return respostaErro(400, "Pedido inválido.");

  const lido = await lerEncerramento(criarClienteServico(), usuario.id, tentativa_id);
  if ("erro" in lido) return erroDoBanco(lido.erro, "Não foi possível carregar o gabarito agora.");
  return Response.json(
    { codigo_correto: lido.dados.codigo_correto, linha_defeito: lido.dados.linha_defeito },
    { headers: { "cache-control": "no-store" } },
  );
}

// POST /api/encerrar — desistência (RF-13, RN-06, D-17).
// Corpo: { tentativa_id, codigo }. Grava editou com o código atual (RN-12) e
// encerrou {desfecho: desistiu}; a tentativa fecha com pdr_final = 0, que é o que
// calcularPdr dá para uma desistência. O feedback é gerado depois da resposta (RF-15).

import { after } from "next/server";

import { erroDoBanco, lerPedidoDaTentativa, respostaErro } from "@/lib/api";
import { garantirFeedback } from "@/lib/encerramento";
import { contarLinhasAlteradas } from "@/lib/linhas-alteradas";
import { criarClienteServico } from "@/lib/supabase/servico";
import type { LinhaExercicio } from "@/lib/tentativa";

export const maxDuration = 30;

const TAMANHO_MAXIMO = 20_000;

export async function POST(request: Request) {
  const pedido = await lerPedidoDaTentativa(request);
  if ("erro" in pedido) return pedido.erro;
  const codigo = pedido.corpo.codigo;
  if (typeof codigo !== "string" || codigo.length > TAMANHO_MAXIMO) return respostaErro(400, "Pedido inválido.");
  const ids = { p_usuario: pedido.usuario.id, p_tentativa: pedido.tentativaId };
  const banco = criarClienteServico();
  const falha = "Não foi possível encerrar agora.";

  const { data: linhas, error: erroExercicio } = await banco.rpc("exercicio_da_tentativa", ids);
  if (erroExercicio) return respostaErro(500, falha);
  const exercicio = (linhas as LinhaExercicio[] | null)?.[0];
  if (!exercicio) return respostaErro(404, "Tentativa não encontrada.");

  const { error } = await banco.rpc("encerrar_por_desistencia", {
    ...ids, p_codigo: codigo, p_linhas_alteradas: contarLinhasAlteradas(exercicio.codigo_com_defeito, codigo),
  });
  if (error) return erroDoBanco(error.code, falha);

  after(() => garantirFeedback(banco, pedido.usuario.id, pedido.tentativaId));
  return Response.json({ desfecho: "desistiu", pdr_final: 0 }, { headers: { "cache-control": "no-store" } });
}

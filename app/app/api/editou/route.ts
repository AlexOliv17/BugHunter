// POST /api/editou — registra o código atual do editor (RF-08, RN-12).
// Corpo: { tentativa_id, codigo }. Chamado antes de Precheck, Verificar e Encerrar.
// linhas_alteradas é calculado aqui, contra codigo_com_defeito (RN-08); o número
// enviado pelo navegador não é usado.

import { erroDoBanco, lerPedidoDaTentativa, respostaErro } from "@/lib/api";
import { contarLinhasAlteradas } from "@/lib/linhas-alteradas";
import { criarClienteServico } from "@/lib/supabase/servico";
import type { LinhaExercicio } from "@/lib/tentativa";

const TAMANHO_MAXIMO = 20_000; // caracteres; os programas-base têm poucas centenas

export async function POST(request: Request) {
  const pedido = await lerPedidoDaTentativa(request);
  if ("erro" in pedido) return pedido.erro;
  const codigo = pedido.corpo.codigo;
  if (typeof codigo !== "string" || codigo.length > TAMANHO_MAXIMO) return respostaErro(400, "Pedido inválido.");

  const banco = criarClienteServico();
  const { data: linhas, error: erroLeitura } = await banco.rpc("exercicio_da_tentativa", {
    p_usuario: pedido.usuario.id, p_tentativa: pedido.tentativaId,
  });
  if (erroLeitura) return respostaErro(500, "Não foi possível registrar o código agora.");
  const exercicio = (linhas as LinhaExercicio[] | null)?.[0];
  if (!exercicio) return respostaErro(404, "Tentativa não encontrada.");

  const linhasAlteradas = contarLinhasAlteradas(exercicio.codigo_com_defeito, codigo);
  const { error } = await banco.rpc("registrar_edicao", {
    p_usuario: pedido.usuario.id, p_tentativa: pedido.tentativaId, p_codigo: codigo, p_linhas_alteradas: linhasAlteradas,
  });
  if (error) return erroDoBanco(error.code, "Não foi possível registrar o código agora.");
  return Response.json({ linhas_alteradas: linhasAlteradas }, { headers: { "cache-control": "no-store" } });
}

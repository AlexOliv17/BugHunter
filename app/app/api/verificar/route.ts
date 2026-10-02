// POST /api/verificar — roda a suíte oculta sobre o código do aluno (RF-10, RN-03).
// Corpo: { tentativa_id, codigo }.
//
// 1. grava o código (editou, RN-12), para que o que se verifica seja o registrado;
// 2. busca a suíte no banco e manda ao executor só código, função e entradas (D-26, DA-08);
// 3. compara aqui com o esperado (D-27) e grava verificar; se passou, grava encerrou
//    e fecha a tentativa com o PDR (RN-05).
// A resposta traz só resultado, passados, total e, se encerrou, o PDR final: nada
// sobre o conteúdo dos testes (RN-03, RNF-03).

import { after } from "next/server";

import { erroDoBanco, lerPedidoDaTentativa, respostaErro } from "@/lib/api";
import { garantirFeedback } from "@/lib/encerramento";
import type { Evento } from "@/lib/estado";
import { chamarExecutor, ExecutorIndisponivel } from "@/lib/executor";
import { contarLinhasAlteradas } from "@/lib/linhas-alteradas";
import { BASE_POR_NIVEL, ehNivel } from "@/lib/niveis";
import { calcularPdr } from "@/lib/pdr";
import { criarClienteServico } from "@/lib/supabase/servico";
import type { LinhaExercicio } from "@/lib/tentativa";
import { lerSuite } from "@/lib/valor";
import { avaliar } from "@/lib/verificacao";

export const maxDuration = 30;

const TAMANHO_MAXIMO = 20_000;
const TENTATIVAS_DE_GRAVAR = 3;   // BH008: outro evento entrou enquanto o PDR era calculado

export async function POST(request: Request) {
  const pedido = await lerPedidoDaTentativa(request);
  if ("erro" in pedido) return pedido.erro;
  const codigo = pedido.corpo.codigo;
  if (typeof codigo !== "string" || codigo.length > TAMANHO_MAXIMO) return respostaErro(400, "Pedido inválido.");
  const ids = { p_usuario: pedido.usuario.id, p_tentativa: pedido.tentativaId };
  const banco = criarClienteServico();
  const falha = "Não foi possível verificar agora.";

  const { data: linhas, error: erroExercicio } = await banco.rpc("exercicio_da_tentativa", ids);
  if (erroExercicio) return respostaErro(500, falha);
  const exercicio = (linhas as LinhaExercicio[] | null)?.[0];
  if (!exercicio) return respostaErro(404, "Tentativa não encontrada.");

  // o registro do código e a leitura da suíte não dependem um do outro (RNF-02);
  // o evento verificar só é gravado depois, então o editou continua vindo antes
  const [{ error: erroEdicao }, { data: suites, error: erroSuite }] = await Promise.all([
    banco.rpc("registrar_edicao", {
      ...ids, p_codigo: codigo, p_linhas_alteradas: contarLinhasAlteradas(exercicio.codigo_com_defeito, codigo),
    }),
    banco.rpc("suite_da_tentativa", ids),
  ]);
  if (erroEdicao) return erroDoBanco(erroEdicao.code, falha);
  if (erroSuite) return erroDoBanco(erroSuite.code, falha);
  const suite = (suites as { suite_oculta: string; nome_funcao: string }[] | null)?.[0];
  if (!suite) return respostaErro(500, falha);

  let resultado;
  try {
    const casos = lerSuite(suite.suite_oculta);
    resultado = avaliar(casos, await chamarExecutor(codigo, suite.nome_funcao, casos));
  } catch (e) {
    // falha de infraestrutura não é culpa do aluno: nada é gravado e ele pode tentar de novo
    console.error("verificar:", e instanceof ExecutorIndisponivel ? e.message : e);
    return respostaErro(503, "O Verificar está indisponível agora. Tente de novo em instantes.");
  }

  const nivel = ehNivel(exercicio.nivel) ? exercicio.nivel : "baixo";
  for (let vez = 1; vez <= TENTATIVAS_DE_GRAVAR; vez++) {
    const { data: eventos, error: erroEventos } = await banco
      .from("eventos").select("tipo, payload").eq("tentativa_id", pedido.tentativaId).order("em").order("id");
    if (erroEventos || !eventos) return respostaErro(500, falha);

    const comEste: Evento[] = [...(eventos as Evento[]), { tipo: "verificar", payload: resultado }];
    const pdr = calcularPdr(comEste, { base: BASE_POR_NIVEL[nivel], numero_tentativa: exercicio.numero_tentativa, treino: exercicio.treino });
    const { data: encerrada, error } = await banco.rpc("registrar_verificar", {
      ...ids, p_resultado: resultado.resultado, p_passados: resultado.passados, p_total: resultado.total,
      p_pdr: resultado.resultado === "passou" ? pdr : null, p_eventos_vistos: eventos.length,
    });
    if (error?.code === "BH008" && vez < TENTATIVAS_DE_GRAVAR) continue;
    if (error) return erroDoBanco(error.code, falha);

    // encerrou: o feedback é gerado agora, depois da resposta (RF-15)
    if (encerrada === true) after(() => garantirFeedback(banco, pedido.usuario.id, pedido.tentativaId));
    return Response.json(
      { ...resultado, encerrada: encerrada === true, ...(encerrada === true ? { pdr_final: pdr } : {}) },
      { headers: { "cache-control": "no-store" } },
    );
  }
  return respostaErro(409, falha);
}

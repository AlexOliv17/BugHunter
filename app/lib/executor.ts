import "server-only";

// Chamada ao executor do Verificar (S4-01, DA-08): projeto Vercel separado, sem
// credenciais, autenticado por segredo compartilhado. Vão só o código, o nome da
// função e as entradas; o esperado fica aqui.

import { lerRespostaExecutor, type RespostaExecutor } from "./verificacao";
import { paraFio, type CasoOculto } from "./valor";

// 5 s de execução (RN-03) mais partida a frio e rede; acima disso, falha de infraestrutura.
const LIMITE_CHAMADA_MS = 12_000;

export class ExecutorIndisponivel extends Error {}

export async function chamarExecutor(codigo: string, funcao: string, casos: CasoOculto[]): Promise<RespostaExecutor> {
  const url = process.env.EXECUTOR_URL, segredo = process.env.EXECUTOR_SEGREDO;
  if (!url || !segredo) throw new ExecutorIndisponivel("EXECUTOR_URL ou EXECUTOR_SEGREDO não configurados");
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${segredo}` },
      body: JSON.stringify({ codigo, funcao, entradas: casos.map((c) => paraFio(c.entrada)) }),
      signal: AbortSignal.timeout(LIMITE_CHAMADA_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new ExecutorIndisponivel(`executor inacessível: ${(e as Error).name}`);
  }
  if (!resposta.ok) throw new ExecutorIndisponivel(`executor respondeu ${resposta.status}`);
  try {
    return lerRespostaExecutor(await resposta.json(), casos.length);
  } catch (e) {
    throw new ExecutorIndisponivel(`resposta inválida do executor: ${(e as Error).message}`);
  }
}

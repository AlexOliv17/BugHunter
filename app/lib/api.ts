import "server-only";

// Utilidades dos endpoints da tentativa: autenticação, leitura do corpo e tradução
// dos códigos de erro das funções do banco (BH001…).

import { usuarioAtual } from "./sessao";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const respostaErro = (status: number, mensagem: string) => Response.json({ erro: mensagem }, { status });

const ERROS_DO_BANCO: Record<string, [number, string]> = {
  BH001: [404, "Tentativa não encontrada."],
  BH002: [409, "Esta tentativa já foi encerrada."],
  BH003: [409, "A localização desta tentativa já terminou."],
  BH004: [400, "Essa linha não existe no código."],
  BH005: [400, "Pedido inválido."],
  BH006: [409, "Aponte a linha do defeito antes de editar e testar."],
  BH007: [409, "Os 3 Prechecks desta tentativa já foram usados."],
  BH008: [409, "A tentativa mudou enquanto o resultado era gravado. Tente de novo."],
};

export function erroDoBanco(codigo: string | undefined, padrao: string) {
  const [status, mensagem] = ERROS_DO_BANCO[codigo ?? ""] ?? [500, padrao];
  return respostaErro(status, mensagem);
}

// Autentica e lê o corpo JSON com tentativa_id válido. Devolve a resposta de erro, se houver.
export async function lerPedidoDaTentativa(request: Request) {
  const usuario = await usuarioAtual();
  if (!usuario) return { erro: respostaErro(401, "Entre para continuar.") } as const;
  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo || typeof corpo.tentativa_id !== "string" || !UUID.test(corpo.tentativa_id)) {
    return { erro: respostaErro(400, "Pedido inválido.") } as const;
  }
  return { usuario, corpo, tentativaId: corpo.tentativa_id } as const;
}

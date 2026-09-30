// POST /api/localizar — registra a linha apontada (RF-07, RN-01).
// Corpo: { tentativa_id, linha }. A comparação com linha_defeito é feita no banco;
// a resposta diz só se estava correta e se a localização terminou (RNF-03).

import { usuarioAtual } from "@/lib/sessao";
import { criarClienteServico } from "@/lib/supabase/servico";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const erro = (status: number, mensagem: string) => Response.json({ erro: mensagem }, { status });

const ERROS: Record<string, [number, string]> = {
  BH001: [404, "Tentativa não encontrada."],
  BH002: [409, "Esta tentativa já foi encerrada."],
  BH003: [409, "A localização desta tentativa já terminou."],
  BH004: [400, "Essa linha não existe no código."],
};

export async function POST(request: Request) {
  const usuario = await usuarioAtual();
  if (!usuario) return erro(401, "Entre para continuar.");

  const corpo = (await request.json().catch(() => null)) as { tentativa_id?: unknown; linha?: unknown } | null;
  const tentativaId = corpo?.tentativa_id;
  const linha = corpo?.linha;
  if (typeof tentativaId !== "string" || !UUID.test(tentativaId) || !Number.isInteger(linha)) return erro(400, "Pedido inválido.");

  const { data, error } = await criarClienteServico().rpc("registrar_localizacao", {
    p_usuario: usuario.id, p_tentativa: tentativaId, p_linha: linha,
  });
  if (error) {
    const [status, mensagem] = ERROS[error.code ?? ""] ?? [500, "Não foi possível registrar a linha agora."];
    return erro(status, mensagem);
  }
  const r = (data as { correta: boolean; tentativa_num: number; concluida: boolean }[])[0];
  return Response.json({ correta: r.correta, tentativa: r.tentativa_num, concluida: r.concluida }, { headers: { "cache-control": "no-store" } });
}

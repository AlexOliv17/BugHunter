import "server-only";

// Chamada ao modelo de linguagem do feedback final (RF-15, Documentação §7.4).
// Gemini pela API REST; a chave fica só no servidor. Limite total de 15 s: acima
// disso, quem chama usa o feedback de reserva.
//
// FEEDBACK_MODEL aceita uma lista separada por vírgulas: se um modelo falhar (no
// plano gratuito, "alta demanda" é comum), o próximo é tentado no tempo que resta.

export const LIMITE_MODELO_MS = 15_000;
const TEMPO_MINIMO_MS = 1_500;   // menos que isso não vale começar outra chamada
const LIMITE_POR_MODELO_MS = 8_000;   // quando há outro modelo na fila, para sobrar tempo a ele

export class ModeloIndisponivel extends Error {}

export function modelosConfigurados(valor = process.env.FEEDBACK_MODEL): string[] {
  return (valor ?? "").split(",").map((m) => m.trim()).filter((m) => /^[a-z0-9.-]+$/i.test(m));
}

export async function gerarTexto(entrada: { instrucoes: string; texto: string }): Promise<string> {
  const chave = process.env.FEEDBACK_API_KEY, modelos = modelosConfigurados();
  if (!chave || !modelos.length) throw new ModeloIndisponivel("FEEDBACK_API_KEY ou FEEDBACK_MODEL não configurados");
  const prazo = Date.now() + LIMITE_MODELO_MS;
  const falhas: string[] = [];
  for (const [i, modelo] of modelos.entries()) {
    const resta = prazo - Date.now();
    if (resta < TEMPO_MINIMO_MS) break;
    const limite = i < modelos.length - 1 ? Math.min(resta, LIMITE_POR_MODELO_MS) : resta;
    try {
      return await chamar(chave, modelo, entrada, limite);
    } catch (e) {
      falhas.push(`${modelo}: ${(e as Error).message}`);
    }
  }
  throw new ModeloIndisponivel(falhas.join("; ") || "sem tempo para chamar o modelo");
}

async function chamar(chave: string, modelo: string, { instrucoes, texto }: { instrucoes: string; texto: string }, limiteMs: number) {
  let resposta: Response;
  try {
    resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucoes }] },
        contents: [{ role: "user", parts: [{ text: texto }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(limiteMs),
      cache: "no-store",
    });
  } catch (e) {
    throw new ModeloIndisponivel(`inacessível (${(e as Error).name})`);
  }
  if (!resposta.ok) throw new ModeloIndisponivel(`respondeu ${resposta.status}`);
  const corpo = (await resposta.json().catch(() => null)) as
    | { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    | null;
  const saida = corpo?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!saida.trim()) throw new ModeloIndisponivel("texto vazio");
  return saida;
}

// Verificação de saúde (S0-03): confirma que o servidor alcança o Supabase
// com as duas chaves. Responde só "conectado" ou "falhou" — nenhum valor de
// variável de ambiente, URL ou mensagem de erro é devolvido ao cliente.

type Estado = "conectado" | "falhou";

async function verificar(url: string, chave: string | undefined): Promise<Estado> {
  if (!chave) return "falhou";
  try {
    const resposta = await fetch(url, {
      headers: { apikey: chave },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return resposta.ok ? "conectado" : "falhou";
  } catch {
    return "falhou";
  }
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) {
    return Response.json({ supabase_publica: "falhou", supabase_servico: "falhou" }, { status: 503 });
  }

  const [publica, servico] = await Promise.all([
    verificar(`${base}/auth/v1/settings`, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    verificar(`${base}/rest/v1/`, process.env.SUPABASE_SERVICE_ROLE_KEY),
  ]);

  const ok = publica === "conectado" && servico === "conectado";
  return Response.json(
    { supabase_publica: publica, supabase_servico: servico },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { DESTINO_APOS_ENTRAR, ehDeAcesso, ehProtegida } from "@/lib/rotas";

// Renova a sessão do Supabase a cada navegação e faz o redirecionamento otimista
// das rotas (RF-02). Cada página protegida confere o usuário de novo no servidor.
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          resposta = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) resposta.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const autenticado = Boolean(data?.claims?.sub);
  const caminho = request.nextUrl.pathname;

  const redirecionar = (destino: URL) => {
    const r = NextResponse.redirect(destino);
    for (const c of resposta.cookies.getAll()) r.cookies.set(c);
    return r;
  };

  if (!autenticado && ehProtegida(caminho)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("proximo", caminho + request.nextUrl.search);
    return redirecionar(login);
  }
  if (autenticado && (ehDeAcesso(caminho) || caminho === "/")) {
    return redirecionar(new URL(DESTINO_APOS_ENTRAR, request.url));
  }
  if (!autenticado && caminho === "/") {
    return redirecionar(new URL("/login", request.url));
  }
  return resposta;
}

export const config = {
  // tudo menos arquivos estáticos, o Pyodide servido em /pyodide e as APIs (que respondem 401 por conta própria)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pyodide/|api/).*)"],
};

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente Supabase do servidor com a chave pública: age em nome do usuário da
// sessão (cookies), sujeito a grants e RLS. A chave de serviço não passa por aqui.
export async function criarClienteServidor() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
          } catch {
            // Em Server Components os cookies são só leitura; a renovação da
            // sessão acontece no proxy (S2-02).
          }
        },
      },
    },
  );
}

import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { criarClienteServidor } from "./supabase/servidor";

// Usuário da sessão, validado no servidor do Supabase. `cache` evita repetir a
// consulta quando o layout e a página pedem o usuário na mesma requisição.
export const usuarioAtual = cache(async () => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

// Segunda barreira das rotas protegidas (a primeira é o proxy): valida a sessão
// antes de a página renderizar qualquer coisa.
export async function exigirUsuario(caminhoAtual: string) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect(`/login?proximo=${encodeURIComponent(caminhoAtual)}`);
  return usuario;
}

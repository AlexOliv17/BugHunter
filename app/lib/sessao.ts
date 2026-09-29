import "server-only";

import { redirect } from "next/navigation";

import { criarClienteServidor } from "./supabase/servidor";

// Segunda barreira das rotas protegidas (a primeira é o proxy): valida a sessão
// no servidor do Supabase antes de a página renderizar qualquer coisa.
export async function exigirUsuario(caminhoAtual: string) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?proximo=${encodeURIComponent(caminhoAtual)}`);
  return data.user;
}

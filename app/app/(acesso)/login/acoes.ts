"use server";

import { redirect } from "next/navigation";

import { destinoSeguro } from "@/lib/rotas";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoLogin = { erro?: string; email?: string };

// RF-02: a mensagem é a mesma para e-mail inexistente e senha errada, para não
// revelar se o e-mail está cadastrado.
const ERRO_CREDENCIAIS = "E-mail ou senha incorretos.";

export async function entrar(_anterior: EstadoLogin, formulario: FormData): Promise<EstadoLogin> {
  const email = String(formulario.get("email") ?? "").trim().toLowerCase();
  const senha = String(formulario.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha.", email };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    const limite = error.code === "over_request_rate_limit";
    return { erro: limite ? "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo." : ERRO_CREDENCIAIS, email };
  }
  redirect(destinoSeguro(formulario.get("proximo")));
}

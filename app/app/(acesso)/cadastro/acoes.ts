"use server";

import { redirect } from "next/navigation";

import { mensagemDoErro, normalizar, validarCadastro, type ErrosCadastro } from "@/lib/cadastro";
import { DESTINO_APOS_ENTRAR } from "@/lib/rotas";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoCadastro = { erros?: ErrosCadastro; erroGeral?: string; valores?: { nome: string; email: string } };

export async function cadastrar(_anterior: EstadoCadastro, formulario: FormData): Promise<EstadoCadastro> {
  const dados = normalizar({
    nome: formulario.get("nome"),
    email: formulario.get("email"),
    senha: formulario.get("senha"),
  });
  const valores = { nome: dados.nome, email: dados.email };

  const erros = validarCadastro(dados);
  if (Object.keys(erros).length) return { erros, valores };

  const supabase = await criarClienteServidor();
  // O nome vai nos metadados da conta; a linha em usuarios é criada a partir dele (S2-03).
  const { data, error } = await supabase.auth.signUp({
    email: dados.email,
    password: dados.senha,
    options: { data: { nome: dados.nome } },
  });
  if (error) return { erroGeral: mensagemDoErro(error.code), valores };
  // Com a confirmação de e-mail desligada (D-07), o cadastro já devolve a sessão.
  if (!data.session) return { erroGeral: mensagemDoErro(undefined), valores };

  redirect(DESTINO_APOS_ENTRAR);
}

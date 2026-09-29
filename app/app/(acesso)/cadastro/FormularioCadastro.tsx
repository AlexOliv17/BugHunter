"use client";

import Link from "next/link";
import { useActionState } from "react";

import { SENHA_MINIMA } from "@/lib/cadastro";
import { Campo } from "../Campo";
import { cadastrar, type EstadoCadastro } from "./acoes";

export function FormularioCadastro() {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(cadastrar, {});

  return (
    <form action={acao} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold">Criar conta</h1>
        <p className="mt-2 text-texto-secundario">Comece pelo primeiro defeito.</p>
      </div>

      {estado.erroGeral && (
        <p role="alert" className="rounded border border-perigo/40 bg-perigo/10 px-4 py-3 text-sm text-perigo">
          {estado.erroGeral}
        </p>
      )}

      <Campo id="nome" rotulo="Nome" tipo="text" autocomplete="name" valor={estado.valores?.nome} erro={estado.erros?.nome} />
      <Campo id="email" rotulo="E-mail" tipo="email" autocomplete="email" valor={estado.valores?.email} erro={estado.erros?.email} />
      <Campo id="senha" rotulo="Senha" tipo="password" autocomplete="new-password" erro={estado.erros?.senha}
        dica={`Ao menos ${SENHA_MINIMA} caracteres.`} />

      <button type="submit" disabled={enviando}
        className="mt-2 h-12 rounded bg-destaque font-semibold text-sobre-destaque transition-opacity hover:opacity-90 disabled:opacity-60">
        {enviando ? "Criando conta…" : "Criar conta"}
      </button>

      <p className="text-sm text-texto-secundario">
        Já tem conta? <Link href="/login" className="text-destaque hover:underline">Entrar</Link>
      </p>
    </form>
  );
}

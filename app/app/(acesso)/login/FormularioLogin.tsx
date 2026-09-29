"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Campo } from "../Campo";
import { entrar, type EstadoLogin } from "./acoes";

export function FormularioLogin({ proximo }: { proximo?: string }) {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold">Entrar</h1>
        <p className="mt-2 text-texto-secundario">Continue de onde parou.</p>
      </div>

      {estado.erro && (
        <p role="alert" className="rounded border border-perigo/40 bg-perigo/10 px-4 py-3 text-sm text-perigo">
          {estado.erro}
        </p>
      )}

      {proximo && <input type="hidden" name="proximo" value={proximo} />}
      <Campo id="email" rotulo="E-mail" tipo="email" autocomplete="email" valor={estado.email} />
      <Campo id="senha" rotulo="Senha" tipo="password" autocomplete="current-password" />

      <button type="submit" disabled={enviando}
        className="mt-2 h-12 rounded bg-destaque font-semibold text-sobre-destaque transition-opacity hover:opacity-90 disabled:opacity-60">
        {enviando ? "Entrando…" : "Entrar"}
      </button>

      <p className="text-sm text-texto-secundario">
        Não tem conta? <Link href="/cadastro" className="text-destaque hover:underline">Criar agora</Link>
      </p>
    </form>
  );
}

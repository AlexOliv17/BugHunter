"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { RespostaTentativa } from "@/lib/tentativa";

// Versão mínima da tela do exercício (S2-06): carrega a tentativa pelo endpoint e
// mostra enunciado, exemplo e código. O layout completo e o editor são a S3-01/S3-02.
export function TelaExercicio({ tentativaId }: { tentativaId: string }) {
  const [dados, setDados] = useState<RespostaTentativa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/tentativa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tentativa_id: tentativaId }),
    })
      .then(async (r) => ({ ok: r.ok, corpo: await r.json().catch(() => null) }))
      .then(({ ok, corpo }) => {
        if (!ativo) return;
        if (ok) setDados(corpo);
        else setErro(corpo?.erro ?? "Não foi possível carregar o exercício.");
      })
      .catch(() => ativo && setErro("Não foi possível carregar o exercício."));
    return () => {
      ativo = false;
    };
  }, [tentativaId]);

  if (erro) {
    return (
      <main className="mx-auto w-full max-w-4xl px-10 py-16">
        <p role="alert" className="text-perigo">{erro}</p>
        <Link href="/temas" className="mt-4 inline-block text-destaque hover:underline">Voltar aos temas</Link>
      </main>
    );
  }
  if (!dados) return <main className="mx-auto w-full max-w-4xl px-10 py-16 text-texto-secundario">Carregando o exercício…</main>;

  const { exercicio, tentativa } = dados;
  return (
    <main className="mx-auto w-full max-w-4xl px-10 py-12">
      <p className="text-sm text-texto-secundario">
        Nível {exercicio.nivel === "medio" ? "médio" : "baixo"} · até {exercicio.base} pts
        {tentativa.numero > 1 && ` · tentativa ${tentativa.numero}, vale metade`}
      </p>
      <h1 className="mt-2 font-mono text-2xl font-semibold">{exercicio.assinatura}</h1>
      <p className="mt-3 text-texto-secundario">{exercicio.descricao}</p>
      <p className="mt-4 text-sm">
        <span className="text-texto-secundario">Teste de exemplo: </span>
        <code className="font-mono">{exercicio.teste_exemplo.chamada}</code>
        <span className="text-texto-secundario"> → </span>
        <code className="font-mono">{JSON.stringify(exercicio.teste_exemplo.esperado)}</code>
      </p>
      <pre className="mt-6 rounded border border-borda bg-painel py-4 font-mono text-sm leading-7">
        {exercicio.codigo.split("\n").map((linha, i) => (
          <div key={i} className="flex px-4">
            <span aria-hidden className="w-8 shrink-0 select-none text-texto-apagado">{i + 1}</span>
            <span>{linha}</span>
          </div>
        ))}
      </pre>
    </main>
  );
}

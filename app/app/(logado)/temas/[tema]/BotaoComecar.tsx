"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Começar (RF-04, critério 3): abre ou retoma a tentativa pela regra do RF-05 e
// leva à tela do exercício.
export function BotaoComecar({ tema, nivel }: { tema: string; nivel: string }) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function comecar() {
    setAbrindo(true);
    setErro(null);
    const resposta = await fetch("/api/tentativa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tema, nivel }),
    }).catch(() => null);
    const corpo = await resposta?.json().catch(() => null);
    if (!resposta?.ok || !corpo?.tentativa?.id) {
      setErro(corpo?.erro ?? "Não foi possível abrir o exercício agora.");
      setAbrindo(false);
      return;
    }
    router.push(`/exercicio/${corpo.tentativa.id}`);
  }

  return (
    <>
      <button type="button" onClick={comecar} disabled={abrindo}
        className="mt-5 h-12 rounded border border-borda font-semibold text-texto-secundario transition-colors group-hover:border-destaque group-hover:bg-destaque group-hover:text-sobre-destaque disabled:opacity-60">
        {abrindo ? "Abrindo…" : "Começar"}
      </button>
      {erro && <p role="alert" className="mt-2 text-sm text-perigo">{erro}</p>}
    </>
  );
}

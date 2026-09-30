"use client";

// Ciclo de vida do Web Worker do Precheck (S3-06, RN-02). O Pyodide carrega quando a
// página abre e o worker fica vivo; o relógio de 2 s começa quando o código é
// enviado a um worker já pronto. Estourou: terminate() e um worker novo.

import { useCallback, useEffect, useRef, useState } from "react";

import { LIMITE_MS, type ResultadoPrecheck } from "@/lib/precheck";

export type AmbientePrecheck = "carregando" | "pronto" | "executando" | "falhou";

export function usePrecheck() {
  const worker = useRef<Worker | null>(null);
  const [ambiente, setAmbiente] = useState<AmbientePrecheck>("carregando");

  const criar = useCallback(() => {
    worker.current?.terminate();
    setAmbiente("carregando");
    const w = new Worker("/precheck/worker.js", { type: "module" });
    w.addEventListener("message", function aoPronto(e: MessageEvent) {
      if (e.data?.tipo !== "pronto") return;
      w.removeEventListener("message", aoPronto);
      if (worker.current === w) setAmbiente("pronto");
    });
    w.addEventListener("error", () => worker.current === w && setAmbiente("falhou"));
    worker.current = w;
  }, []);

  useEffect(() => {
    criar();
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, [criar]);

  // Só chame com o ambiente "pronto"; quem chama decide consumir o uso.
  const executar = useCallback((dados: { codigo: string; funcao: string; entrada: unknown[]; esperado: unknown }) =>
    new Promise<ResultadoPrecheck>((resolve) => {
      const w = worker.current;
      if (!w) return resolve({ resultado: "erro", erro: "ambiente indisponível" });
      setAmbiente("executando");
      const relogio = setTimeout(() => {
        w.removeEventListener("message", aoResultado);
        criar();                                   // encerra o worker preso e prepara outro
        resolve({ resultado: "tempo_excedido" });
      }, LIMITE_MS);
      function aoResultado(e: MessageEvent) {
        if (e.data?.tipo !== "resultado") return;
        clearTimeout(relogio);
        w!.removeEventListener("message", aoResultado);
        setAmbiente("pronto");
        const resultado = { ...e.data };
        delete resultado.tipo;
        resolve(resultado as ResultadoPrecheck);
      }
      w.addEventListener("message", aoResultado);
      w.postMessage(dados);
    }), [criar]);

  return { ambiente, executar, recarregar: criar };
}

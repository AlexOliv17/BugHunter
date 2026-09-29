"use client";

// Spike S0-06 — Pyodide num Web Worker, encerrado por terminate() ao estourar 2 s.
// Descartável: substituído pela implementação da S3-06. Só roda casos fixos.

import { useEffect, useState } from "react";

const LIMITE_MS = 2000;

const MEDIA_CORRETA = `def media_das_notas(notas):
    soma = 0
    for n in notas:
        soma += n
    return soma / len(notas)
`;

const EXEMPLO = { chamada: "media_das_notas([7, 8, 9])", esperado: "8.0" };

const CASOS: [string, string][] = [
  ["ok", MEDIA_CORRETA],
  ["falha", MEDIA_CORRETA.replace("soma += n", "soma += 1")],
  ["excecao", MEDIA_CORRETA.replace("return soma / len(notas)", "return soma / 0")],
  ["laco_infinito", "def media_das_notas(notas):\n    while True:\n        pass\n"],
  ["ok_apos_recriar", MEDIA_CORRETA],
];

type Linha = { caso: string; resultado: string; obtido?: string; tempo_ms: number; carga_ms?: number };

function criarWorker() {
  const worker = new Worker("/spike/precheck-worker.js", { type: "module" });
  const pronto = new Promise<number>((resolve) => {
    worker.addEventListener("message", function aoPronto(e: MessageEvent) {
      if (e.data.tipo === "pronto") {
        worker.removeEventListener("message", aoPronto);
        resolve(e.data.carga_ms);
      }
    });
  });
  return { worker, pronto };
}

function executar(atual: { worker: Worker }, codigo: string) {
  return new Promise<Omit<Linha, "caso">>((resolve) => {
    const t0 = performance.now();
    const relogio = setTimeout(() => {
      atual.worker.terminate();
      resolve({ resultado: "tempo_excedido", tempo_ms: Math.round(performance.now() - t0) });
    }, LIMITE_MS);
    atual.worker.addEventListener(
      "message",
      (e: MessageEvent) => {
        clearTimeout(relogio);
        resolve({ resultado: e.data.resultado, obtido: e.data.obtido, tempo_ms: Math.round(performance.now() - t0) });
      },
      { once: true },
    );
    atual.worker.postMessage({ codigo, ...EXEMPLO });
  });
}

export default function SpikePrecheck() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [estado, setEstado] = useState("preparando o ambiente");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      let atual = criarWorker();
      let carga: number | undefined = await atual.pronto;
      for (const [caso, codigo] of CASOS) {
        if (cancelado) return;
        setEstado(`executando ${caso}`);
        const r = await executar(atual, codigo);
        const linha = { caso, ...r, carga_ms: carga };
        setLinhas((l) => [...l, linha]);
        carga = undefined;
        if (r.resultado === "tempo_excedido") {
          atual = criarWorker();
          carga = await atual.pronto;
        }
      }
      setEstado("concluído");
      (window as unknown as { __spike: unknown }).__spike = "concluído";
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <main className="p-8 font-mono text-sm">
      <h1 className="text-lg font-semibold mb-2">Spike S0-06 — Precheck no navegador</h1>
      <p className="mb-4">
        Estado: <span id="estado">{estado}</span>
      </p>
      <table id="resultados" className="border-collapse">
        <thead>
          <tr>
            {["caso", "resultado", "obtido", "tempo_ms", "carga_ms"].map((c) => (
              <th key={c} className="border px-2 py-1 text-left">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.caso}>
              <td className="border px-2 py-1">{l.caso}</td>
              <td className="border px-2 py-1">{l.resultado}</td>
              <td className="border px-2 py-1">{l.obtido ?? ""}</td>
              <td className="border px-2 py-1">{l.tempo_ms}</td>
              <td className="border px-2 py-1">{l.carga_ms ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

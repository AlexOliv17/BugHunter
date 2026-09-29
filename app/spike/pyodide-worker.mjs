// Spike S0-05 — thread que carrega o Pyodide e executa um script Python.
// Descartável: removido após a decisão da S0-07.
import { parentPort, workerData } from "node:worker_threads";
import { loadPyodide } from "pyodide";

const inicio = performance.now();
const pyodide = await loadPyodide({ indexURL: workerData.indexURL });
parentPort.postMessage({ tipo: "pronto", carga_ms: Math.round(performance.now() - inicio) });

parentPort.on("message", async ({ fonte }) => {
  const t0 = performance.now();
  try {
    const saida = await pyodide.runPythonAsync(fonte);
    parentPort.postMessage({ tipo: "resultado", saida: String(saida), tempo_ms: Math.round(performance.now() - t0) });
  } catch (e) {
    parentPort.postMessage({ tipo: "erro", nome: e?.type ?? e?.name ?? "Erro", tempo_ms: Math.round(performance.now() - t0) });
  }
});

// Spike S0-06 — Web Worker do Precheck: carrega o Pyodide e roda o teste de exemplo.
// Descartável: substituído pela implementação da S3-06.
import { loadPyodide } from "/pyodide/pyodide.mjs";

const inicio = performance.now();
const pronto = loadPyodide({ indexURL: "/pyodide/" }).then((py) => {
  self.postMessage({ tipo: "pronto", carga_ms: Math.round(performance.now() - inicio) });
  return py;
});

self.onmessage = async ({ data: { codigo, chamada, esperado } }) => {
  const py = await pronto;
  const t0 = performance.now();
  try {
    py.globals.set("__codigo", codigo);
    py.globals.set("__chamada", chamada);
    const obtido = py.runPython(`
exec(compile(__codigo, "aluno.py", "exec"), globals())
repr(eval(__chamada))
`);
    const passou = obtido === esperado;
    self.postMessage({ tipo: "resultado", resultado: passou ? "passou" : "falhou", obtido, tempo_ms: Math.round(performance.now() - t0) });
  } catch (e) {
    self.postMessage({ tipo: "resultado", resultado: "erro", obtido: String(e?.type ?? e?.name ?? "Erro"), tempo_ms: Math.round(performance.now() - t0) });
  }
};

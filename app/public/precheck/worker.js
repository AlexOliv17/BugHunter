// Web Worker do Precheck (S3-06, DA-03): Pyodide carregado uma vez e mantido vivo.
// Worker do tipo módulo: o Pyodide 314 não roda em worker clássico (S0-06).
// O limite de 2 s é aplicado por quem cria o worker, com terminate().
import { loadPyodide } from "/pyodide/pyodide.mjs";

const pyodide = await loadPyodide({ indexURL: "/pyodide/", stdout: () => {}, stderr: () => {} });
pyodide.runPython(await (await fetch("/precheck/nucleo.py")).text());
const executarExemplo = pyodide.globals.get("executar_exemplo");
self.postMessage({ tipo: "pronto" });

self.onmessage = ({ data }) => {
  const r = executarExemplo(data.codigo, data.funcao, JSON.stringify(data.entrada), JSON.stringify(data.esperado));
  self.postMessage({ tipo: "resultado", ...JSON.parse(r) });
};

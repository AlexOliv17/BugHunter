// Spike S0-05 — rota B: Pyodide executado no servidor, dentro de um route handler Node.
// Descartável: removido após a decisão da S0-07. Só roda casos fixos definidos
// aqui (nenhum código é aceito do cliente) e responde contagens e tempos.
//
// GET /api/spike_rota_b?caso=<nome>   (sem caso: lista os casos)

import path from "node:path";
import { Worker } from "node:worker_threads";

export const runtime = "nodejs";
export const maxDuration = 30;

const LIMITE_MS = 5000;

const MEDIA_CORRETA = `
def media_das_notas(notas):
    soma = 0
    for n in notas:
        soma += n
    return soma / len(notas)
`;

const TESTES = [
  ["media_das_notas([7, 8, 9])", 8.0],
  ["media_das_notas([10])", 10.0],
  ["media_das_notas([0, 5])", 2.5],
];

const CASOS: Record<string, string> = {
  ok: MEDIA_CORRETA,
  falha: MEDIA_CORRETA.replace("soma += n", "soma += 1"),
  excecao: MEDIA_CORRETA.replace("return soma / len(notas)", "return soma / 0"),
  laco_infinito: "def media_das_notas(notas):\n    while True:\n        pass\n",
  memoria: "def media_das_notas(notas):\n    x = []\n    while True:\n        x.append(' ' * 10_000_000)\n",
};

function scriptSuite(codigo: string): string {
  return `
import json
passados, erro = 0, None
try:
    exec(compile(${JSON.stringify(codigo)}, "aluno.py", "exec"), globals())
    for chamada, esperado in json.loads(${JSON.stringify(JSON.stringify(TESTES))}):
        try:
            if eval(chamada) == esperado:
                passados += 1
        except Exception:
            pass
except Exception as e:
    erro = type(e).__name__
json.dumps({"passados": passados, "total": ${TESTES.length}, "erro": erro})
`;
}

type Mensagem =
  | { tipo: "pronto"; carga_ms: number }
  | { tipo: "resultado"; saida: string; tempo_ms: number }
  | { tipo: "erro"; nome: string; tempo_ms: number };

// Uma thread quente reaproveitada entre requisições da mesma instância.
let quente: { worker: Worker; pronto: Promise<number> } | null = null;
let chamadas = 0;
const inicioInstancia = Date.now();

function criarWorker() {
  const base = path.join(process.cwd(), "node_modules", "pyodide") + path.sep;
  const worker = new Worker(path.join(process.cwd(), "spike", "pyodide-worker.mjs"), {
    workerData: { indexURL: base },
  });
  const pronto = new Promise<number>((resolve, reject) => {
    worker.once("message", (m: Mensagem) => (m.tipo === "pronto" ? resolve(m.carga_ms) : reject(new Error("inicio"))));
    worker.once("error", reject);
  });
  return { worker, pronto };
}

async function executar(caso: string) {
  const novaThread = quente === null;
  if (!quente) quente = criarWorker();
  const atual = quente;
  const t0 = Date.now();
  const cargaMs = await atual.pronto;
  const esperaCargaMs = Date.now() - t0;

  const resultado = await new Promise<Record<string, unknown>>((resolve) => {
    const relogio = setTimeout(() => {
      atual.worker.terminate();
      if (quente === atual) quente = null;
      resolve({ resultado: "tempo_excedido", tempo_ms: LIMITE_MS });
    }, LIMITE_MS);

    const aoSair = () => {
      clearTimeout(relogio);
      if (quente === atual) quente = null;
      resolve({ resultado: "erro", motivo: "thread encerrada" });
    };
    atual.worker.once("exit", aoSair);

    atual.worker.once("message", (m: Mensagem) => {
      clearTimeout(relogio);
      atual.worker.off("exit", aoSair);
      if (m.tipo === "resultado") {
        const r = JSON.parse(m.saida) as { passados: number; total: number; erro: string | null };
        const status = r.erro ? "erro" : r.passados === r.total ? "passou" : "falhou";
        resolve({ resultado: status, passados: r.passados, total: r.total, tempo_ms: m.tempo_ms });
      } else if (m.tipo === "erro") {
        resolve({ resultado: "erro", tempo_ms: m.tempo_ms });
      }
    });
    atual.worker.postMessage({ fonte: scriptSuite(CASOS[caso]) });
  });

  return {
    ...resultado,
    thread_nova: novaThread,
    carga_pyodide_ms: novaThread ? cargaMs : undefined,
    espera_carga_ms: novaThread ? esperaCargaMs : undefined,
  };
}

export async function GET(request: Request) {
  chamadas += 1;
  const caso = new URL(request.url).searchParams.get("caso");
  const instancia = { chamada_nesta_instancia: chamadas, idade_instancia_s: Math.round((Date.now() - inicioInstancia) / 100) / 10 };

  if (!caso) return Response.json({ casos: Object.keys(CASOS), instancia });
  if (!(caso in CASOS)) return Response.json({ erro: "caso desconhecido" }, { status: 400 });

  try {
    const r = await executar(caso);
    return Response.json({ caso, ...r, instancia }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("spike_rota_b: falha ao iniciar", e);
    quente = null;
    return Response.json({ caso, resultado: "erro", motivo: "falha ao iniciar o Pyodide", instancia }, { status: 500 });
  }
}

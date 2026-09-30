// Roda o mesmo public/precheck/nucleo.py do navegador, num Pyodide em Node, contra os
// casos de referência da D-27 compartilhados com o pipeline.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPyodide, type PyodideInterface } from "pyodide";
import { beforeAll, describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..");
let py: PyodideInterface;
let executar: (codigo: string, funcao: string, entrada: string, esperado: string) => string;

beforeAll(async () => {
  py = await loadPyodide();
  py.runPython(readFileSync(join(RAIZ, "public", "precheck", "nucleo.py"), "utf8"));
  executar = py.globals.get("executar_exemplo");
}, 60_000);

type Caso = { obtido: unknown; esperado: unknown; iguais: boolean; motivo: string };
const casos: Caso[] = JSON.parse(readFileSync(join(RAIZ, "..", "pipeline", "tests", "dados", "comparacao.json"), "utf8")).casos;

describe("iguais (D-27), idêntica à do pipeline", () => {
  it.each(casos)("$motivo", (c) => {
    // o JSON entra no Python exatamente como no pipeline: pelo json.loads
    const r = py.runPython(`iguais(json.loads(${JSON.stringify(JSON.stringify(c.obtido))}), json.loads(${JSON.stringify(JSON.stringify(c.esperado))}))`);
    expect(r).toBe(c.iguais);
  });
});

const run = (codigo: string, entrada: unknown[], esperado: unknown) =>
  JSON.parse(executar(codigo, "f", JSON.stringify(entrada), JSON.stringify(esperado)));

describe("executar_exemplo (RF-09)", () => {
  it("passou, com o obtido como o Python mostra", () => {
    expect(run("def f(xs):\n    return sum(xs) / len(xs)", [[7, 8, 9]], 8)).toEqual({ resultado: "passou", obtido: "8.0" });
  });
  it("falhou mostra o valor obtido", () => {
    expect(run("def f(xs):\n    return sum(xs[:-1]) / len(xs)", [[8, 6, 10]], 8)).toEqual({ resultado: "falhou", obtido: "4.666666666666667" });
  });
  it("tolerância decimal: soma em outra ordem passa", () => {
    expect(run("def f(xs):\n    t = 0\n    for x in xs: t += x\n    return t / len(xs)", [[0.1, 0.2, 0.3]], 0.2).resultado).toBe("passou");
  });
  it("tupla é comparada como lista, igual ao Verificar", () => {
    expect(run("def f(xs):\n    return tuple(reversed(xs))", [[1, 2, 3]], [3, 2, 1]).resultado).toBe("passou");
  });
  it("exceção na chamada é erro, com o tipo", () => {
    const r = run("def f(xs):\n    return 1 / 0", [[1]], 1);
    expect(r.resultado).toBe("erro");
    expect(r.erro).toMatch(/^ZeroDivisionError/);
  });
  it("código que não compila é erro", () => {
    expect(run("def f(xs)\n    return 1", [[1]], 1).resultado).toBe("erro");
  });
  it("função ausente é erro", () => {
    expect(run("def g(xs):\n    return 1", [[1]], 1)).toEqual({ resultado: "erro", erro: "a função f não está definida" });
  });
  it("uma execução não contamina a próxima", () => {
    run("VAZOU = 1\ndef f(xs):\n    return 1", [[1]], 1);
    expect(run("def f(xs):\n    return VAZOU", [[1]], 1).resultado).toBe("erro");
  });
});

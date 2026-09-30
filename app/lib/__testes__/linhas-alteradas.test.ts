import { describe, expect, it } from "vitest";

import { contarLinhasAlteradas, linhasMarcadas } from "../linhas-alteradas";

const original = ["def f(xs):", "    t = 0", "    for x in xs:", "        t -= x", "    return t"].join("\n");
const trocar = (n: number, texto: string) => original.split("\n").map((l, i) => (i === n - 1 ? texto : l)).join("\n");

describe("contarLinhasAlteradas (RN-08)", () => {
  it("sem mudança: 0", () => {
    expect(contarLinhasAlteradas(original, original)).toBe(0);
  });
  it("uma linha modificada conta 1, não 2", () => {
    expect(contarLinhasAlteradas(original, trocar(4, "        t += x"))).toBe(1);
  });
  it("uma linha inserida conta 1", () => {
    const atual = original.replace("    return t", "    t = t\n    return t");
    expect(contarLinhasAlteradas(original, atual)).toBe(1);
  });
  it("uma linha removida conta 1", () => {
    expect(contarLinhasAlteradas(original, original.replace("    t = 0\n", ""))).toBe(1);
  });
  it("modificações em pontos diferentes somam", () => {
    expect(contarLinhasAlteradas(original, trocar(2, "    t = 1").replace("t -= x", "t += x"))).toBe(2);
  });
  it("trocar uma linha por duas conta 2; três modificações e uma inserção contam 3", () => {
    const atual = original.replace("    for x in xs:\n        t -= x", "    for x in xs:\n        a = x\n        t += a");
    expect(contarLinhasAlteradas(original, atual)).toBe(2);
    const atual2 = original.replace("    t = 0\n    for x in xs:\n        t -= x", "    t = 0\n    s = 0\n    for y in xs:\n        t += y");
    expect(contarLinhasAlteradas(original, atual2)).toBe(3);
  });
  it("reescrever tudo conta todas as linhas", () => {
    expect(contarLinhasAlteradas(original, "def f(xs):\n    return sum(xs)")).toBe(4);
  });
  it("ignora a diferença entre \\r\\n e \\n", () => {
    expect(contarLinhasAlteradas(original, original.replace(/\n/g, "\r\n"))).toBe(0);
  });
});

describe("linhasMarcadas", () => {
  it("marca a linha modificada no código atual", () => {
    expect(linhasMarcadas(original, trocar(4, "        t += x"))).toEqual([4]);
  });
  it("marca a linha inserida", () => {
    expect(linhasMarcadas(original, original.replace("    return t", "    t = t\n    return t"))).toEqual([5]);
  });
  it("remoção não marca nada no código atual", () => {
    expect(linhasMarcadas(original, original.replace("    t = 0\n", ""))).toEqual([]);
  });
});

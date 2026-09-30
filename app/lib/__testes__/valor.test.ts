import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { deFio, iguais, lerSuite, lerValor, paraFio, ValorInvalido, type Valor } from "../valor";

const RAIZ = join(__dirname, "..", "..", "..");
const ler = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");

describe("iguais (D-27): mesmos casos de referência do pipeline e do Precheck", () => {
  // o arquivo é lido com o tipo de cada número, como a suíte oculta
  const ref = lerValor(ler("pipeline", "tests", "dados", "comparacao.json"));
  const casos = ref.t === "dict" && ref.v.casos.t === "list" ? ref.v.casos.v : [];
  it("há casos", () => expect(casos.length).toBeGreaterThan(10));
  for (const c of casos) {
    if (c.t !== "dict") continue;
    const { obtido, esperado, iguais: esperadoIguais, motivo } = c.v;
    it(`${(motivo as { v: string }).v}`, () => {
      expect(iguais(obtido, esperado)).toBe((esperadoIguais as { v: boolean }).v);
    });
  }
  it("inteiros grandes: igualdade exata, sem arredondar", () => {
    expect(iguais(lerValor("100000000000000000001"), lerValor("100000000000000000000"))).toBe(false);
    expect(iguais(lerValor("1000000001"), lerValor("1000000000"))).toBe(false);
    expect(iguais(lerValor("1000000001.0"), lerValor("1000000000"))).toBe(true);
  });
  it("dicionário não confunde chaves do protótipo", () => {
    expect(iguais(lerValor('{"a": 1}'), lerValor('{"constructor": 1}'))).toBe(false);
  });
  it("NaN nunca é igual; infinito é igual a infinito", () => {
    expect(iguais({ t: "float", v: NaN }, { t: "float", v: NaN })).toBe(false);
    expect(iguais({ t: "float", v: Infinity }, { t: "float", v: Infinity })).toBe(true);
  });
});

describe("fio: mesmos casos de referência do executor", () => {
  const casos: { fonte: string; fio: unknown }[] = JSON.parse(ler("executor", "tests", "dados", "fio.json")).casos;
  for (const c of casos) {
    it(c.fonte, () => {
      const valor = lerValor(c.fonte);
      expect(paraFio(valor)).toEqual(c.fio);
      expect(deFio(c.fio)).toEqual(valor);
    });
  }
  it("decimais especiais", () => {
    expect(deFio({ t: "float", v: "inf" })).toMatchObject({ t: "float", v: Infinity });
    expect(Number.isNaN((deFio({ t: "float", v: "nan" }) as { v: number }).v)).toBe(true);
    expect(paraFio({ t: "float", v: 8 })).toEqual({ t: "float", v: "8.0" });
  });
  it("recusa fio malformado", () => {
    for (const ruim of [null, [1], { t: "int", v: 8 }, { t: "int", v: "8.5" }, { t: "float", v: "abc" }, { t: "x" }, { t: "list", v: "a" }]) {
      expect(() => deFio(ruim)).toThrow(ValorInvalido);
    }
  });
  it("recusa fio profundo demais", () => {
    let fio: unknown = { t: "none" };
    for (let i = 0; i < 300; i++) fio = { t: "list", v: [fio] };
    expect(() => deFio(fio)).toThrow(ValorInvalido);
  });
});

describe("lerSuite (D-26)", () => {
  it("lê entrada e esperado com o tipo de cada número", () => {
    const [caso] = lerSuite('[{"entrada": [[7, 8, 9]], "esperado": 8.0}]');
    expect(caso.esperado).toEqual({ t: "float", v: 8, fonte: "8.0" });
    expect(paraFio(caso.entrada)).toEqual({ t: "list", v: [{ t: "list", v: [{ t: "int", v: "7" }, { t: "int", v: "8" }, { t: "int", v: "9" }] }] });
  });
  it("recusa suíte fora do formato", () => {
    for (const ruim of ["[]", "{}", '[{"entrada": 1, "esperado": 2}]', '[{"entrada": []}]']) {
      expect(() => lerSuite(ruim)).toThrow(ValorInvalido);
    }
  });
});

export type { Valor };

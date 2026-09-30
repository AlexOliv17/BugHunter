import { describe, expect, it } from "vitest";

import { obtidoDoResultado, resultadoDoUso, type ResultadoPrecheck } from "../precheck";

describe("ida e volta do resultado do Precheck (S3-07)", () => {
  const casos: ResultadoPrecheck[] = [
    { resultado: "passou", obtido: "8.0" },
    { resultado: "falhou", obtido: "3" },
    { resultado: "erro", erro: "ZeroDivisionError: division by zero" },
    { resultado: "tempo_excedido" },
  ];
  for (const r of casos) {
    it(`${r.resultado}: o gravado reconstrói o mesmo resultado`, () => {
      expect(resultadoDoUso({ resultado: r.resultado, obtido: obtidoDoResultado(r) })).toEqual(r);
    });
  }
  it("tempo excedido não grava obtido", () => {
    expect(obtidoDoResultado({ resultado: "tempo_excedido" })).toBeNull();
  });
});

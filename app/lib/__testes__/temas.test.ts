import { describe, expect, it } from "vitest";

import { montarCards } from "../temas";

const temas = [
  { codigo: "poo", nome: "POO", descricao: "d", ativo: false, ordem: 2 },
  { codigo: "fundamentos", nome: "Fundamentos", descricao: "d", ativo: true, ordem: 1 },
];

describe("montarCards (RF-03)", () => {
  it("ordena pela coluna ordem (D-25)", () => {
    expect(montarCards(temas, []).map((t) => t.codigo)).toEqual(["fundamentos", "poo"]);
  });
  it("mostra resolvidos sobre o total, com porcentagem arredondada", () => {
    const [f] = montarCards(temas, [{ tema_codigo: "fundamentos", total: "15", resolvidos: "11" }]);
    expect([f.resolvidos, f.total, f.porcentagem]).toEqual([11, 15, 73]);
  });
  it("tema sem exercícios fica com 0 de 0, sem dividir por zero", () => {
    const poo = montarCards(temas, []).find((t) => t.codigo === "poo")!;
    expect([poo.resolvidos, poo.total, poo.porcentagem]).toEqual([0, 0, 0]);
  });
});

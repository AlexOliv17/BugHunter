import { describe, expect, it } from "vitest";

import { ehNivel, montarNiveis } from "../niveis";

const linhas = [
  { nivel: "medio", categorias: ["limite de laço deslocado", "acumulador não atualizado"], total: "8", resolvidos: "3" },
  { nivel: "baixo", categorias: ["operador aritmético trocado", "comparador invertido"], total: "7", resolvidos: "0" },
];

describe("montarNiveis (RF-04)", () => {
  it("Baixo vale 100 e Médio 200 (RN-05), nessa ordem", () => {
    expect(montarNiveis(linhas).map((n) => [n.nivel, n.base])).toEqual([["baixo", 100], ["medio", 200]]);
  });
  it("lista os nomes das categorias de cada nível, em ordem alfabética", () => {
    const [baixo, medio] = montarNiveis(linhas);
    expect(baixo.categorias).toEqual(["comparador invertido", "operador aritmético trocado"]);
    expect(medio.categorias).toEqual(["acumulador não atualizado", "limite de laço deslocado"]);
  });
  it("converte as contagens e tolera nível sem linha", () => {
    const [baixo, medio] = montarNiveis([linhas[0]]);
    expect([medio.resolvidos, medio.total]).toEqual([3, 8]);
    expect([baixo.resolvidos, baixo.total, baixo.categorias]).toEqual([0, 0, []]);
  });
});

describe("ehNivel", () => {
  it("aceita só baixo e medio", () => {
    expect(["baixo", "medio", "alto", "", null].map(ehNivel)).toEqual([true, true, false, false, false]);
  });
});

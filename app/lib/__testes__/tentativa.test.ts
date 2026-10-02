import { describe, expect, it } from "vitest";

import { reconstruirEstado } from "../estado";
import { lerPedido, montarResposta, type LinhaExercicio } from "../tentativa";

const vazio = reconstruirEstado([]);

describe("lerPedido", () => {
  it("aceita Começar com tema e nível", () => {
    expect(lerPedido({ tema: "fundamentos", nivel: "medio" })).toEqual({ tipo: "abrir", tema: "fundamentos", nivel: "medio" });
  });
  it("aceita retomar por tentativa_id", () => {
    const id = "972e8088-9870-4c6f-8984-5201bf4189eb";
    expect(lerPedido({ tentativa_id: id })).toEqual({ tipo: "retomar", tentativaId: id });
  });
  it("recusa nível alto, tema estranho, id inválido e corpo vazio", () => {
    for (const c of [{ tema: "fundamentos", nivel: "alto" }, { tema: "x'; drop", nivel: "baixo" }, { tentativa_id: "1" }, null, "x"])
      expect(lerPedido(c)).toBeNull();
  });
});

const linha = {
  tentativa_id: "t1", numero_tentativa: 1, desfecho: "aberto",
  codigo_com_defeito: "def f(x):\n    return x - 1", assinatura: "f(x)", descricao: "d",
  teste_exemplo: { chamada: "f(1)", entrada: [1], esperado: 2, entrada_repr: "1", esperado_repr: "2" },
  tema_codigo: "fundamentos", nivel: "medio", treino: false,
} satisfies LinhaExercicio;

describe("montarResposta (D-20, RNF-03)", () => {
  it("não deixa passar nenhum dos quatro segredos, mesmo que a linha os traga", () => {
    const suja = { ...linha, suite_oculta: "S", codigo_correto: "C", linha_defeito: 2, categoria_codigo: "ARIT_TROC" };
    const texto = JSON.stringify(montarResposta(suja, vazio));
    for (const segredo of ["suite_oculta", "codigo_correto", "linha_defeito", "categoria_codigo", "ARIT_TROC"])
      expect(texto).not.toContain(segredo);
  });
  it("informa a base do nível e o multiplicador de repetição (RN-05, RN-07)", () => {
    expect(montarResposta(linha, vazio).exercicio.base).toBe(200);
    expect(montarResposta(linha, vazio).tentativa.multiplicador_repeticao).toBe(1);
    expect(montarResposta({ ...linha, numero_tentativa: 2 }, vazio).tentativa.multiplicador_repeticao).toBe(0.5);
  });
  it("dicas: só nível e texto das já usadas, sem a categoria (RF-12, RNF-03)", () => {
    const dicas = [{ nivel: 1, texto: "natureza do defeito", categoria_codigo: "ARIT_TROC" }];
    const r = montarResposta(linha, vazio, dicas);
    expect(r.dicas).toEqual([{ nivel: 1, texto: "natureza do defeito" }]);
    expect(JSON.stringify(r)).not.toContain("ARIT_TROC");
  });
});

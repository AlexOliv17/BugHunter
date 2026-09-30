import { describe, expect, it } from "vitest";

import { avaliar, lerRespostaExecutor, RespostaExecutorInvalida } from "../verificacao";
import { lerSuite } from "../valor";

const casos = lerSuite('[{"entrada": [[7, 8, 9]], "esperado": 8.0}, {"entrada": [[10]], "esperado": 10.0}, {"entrada": [[0, 5]], "esperado": 2.5}]');
const f = (v: string) => ({ valor: { t: "float", v } });

describe("avaliar (RN-03, RF-10)", () => {
  it("todos passam", () => {
    expect(avaliar(casos, { situacao: "ok", resultados: [f("8.0"), f("10.0"), f("2.5")] })).toEqual({ resultado: "passou", passados: 3, total: 3 });
  });
  it("inteiro contra decimal de mesmo valor passa (D-27)", () => {
    expect(avaliar(casos, { situacao: "ok", resultados: [{ valor: { t: "int", v: "8" } }, f("10.0"), f("2.5")] }).resultado).toBe("passou");
  });
  it("um valor errado: falhou, com a contagem", () => {
    expect(avaliar(casos, { situacao: "ok", resultados: [f("8.0"), f("9.0"), f("2.5")] })).toEqual({ resultado: "falhou", passados: 2, total: 3 });
  });
  it("exceção num caso: erro, com a contagem dos que passaram", () => {
    expect(avaliar(casos, { situacao: "ok", resultados: [f("8.0"), { erro: "ZeroDivisionError" }, f("2.5")] })).toEqual({ resultado: "erro", passados: 2, total: 3 });
  });
  it("tempo excedido e erro ao carregar: nenhum passa", () => {
    expect(avaliar(casos, { situacao: "tempo_excedido", resultados: [] })).toEqual({ resultado: "tempo_excedido", passados: 0, total: 3 });
    expect(avaliar(casos, { situacao: "erro", resultados: [] })).toEqual({ resultado: "erro", passados: 0, total: 3 });
  });
  it("valor malformado conta como falha, sem derrubar", () => {
    expect(avaliar(casos, { situacao: "ok", resultados: [{ valor: { t: "?" } }, f("10.0"), f("2.5")] })).toEqual({ resultado: "falhou", passados: 2, total: 3 });
  });
});

describe("lerRespostaExecutor", () => {
  it("aceita a resposta no formato", () => {
    expect(lerRespostaExecutor({ situacao: "ok", resultados: [f("1.0"), { erro: "X" }, f("2.0")] }, 3).situacao).toBe("ok");
  });
  it("recusa formato inválido ou quantidade errada", () => {
    for (const ruim of [null, {}, { situacao: "passou", resultados: [] }, { situacao: "ok", resultados: [f("1.0")] }, { situacao: "ok", resultados: [1, 2, 3] }]) {
      expect(() => lerRespostaExecutor(ruim, 3)).toThrow(RespostaExecutorInvalida);
    }
  });
});

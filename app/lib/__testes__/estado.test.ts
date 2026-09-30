import { describe, expect, it } from "vitest";

import { reconstruirEstado } from "../estado";
import { reduzir } from "../maquina-exercicio";

const loc = (linha: number, correta: boolean, n: number) => ({ tipo: "localizou", payload: { linha, correta, tentativa_num: n } });

describe("reconstruirEstado (RN-10, RF-17)", () => {
  it("sem eventos: travado, localização aberta", () => {
    const e = reconstruirEstado([]);
    expect(e.editorLiberado).toBe(false);
    expect(e.localizacao).toMatchObject({ concluida: false, fator: null, tentativas: [] });
  });
  it("acerto na 1ª: liberado, fator 1,0", () => {
    const e = reconstruirEstado([loc(4, true, 1)]);
    expect([e.editorLiberado, e.localizacao.fator]).toEqual([true, 1.0]);
  });
  it("erro e acerto: liberado, fator 0,6", () => {
    const e = reconstruirEstado([loc(6, false, 1), loc(4, true, 2)]);
    expect([e.editorLiberado, e.localizacao.fator]).toEqual([true, 0.6]);
  });
  it("dois erros: liberado automaticamente, fator 0,3", () => {
    const e = reconstruirEstado([loc(6, false, 1), loc(2, false, 2)]);
    expect([e.editorLiberado, e.localizacao.fator, e.localizacao.acertou]).toEqual([true, 0.3, false]);
  });
  it("um erro só: continua travado, com a linha errada registrada", () => {
    const e = reconstruirEstado([loc(6, false, 1)]);
    expect(e.editorLiberado).toBe(false);
    expect(e.localizacao.tentativas).toEqual([{ linha: 6, correta: false }]);
  });
  it("ignora outros tipos de evento e localizações além das duas primeiras", () => {
    const e = reconstruirEstado([{ tipo: "editou", payload: {} }, loc(1, false, 1), loc(2, false, 2), loc(3, true, 3)]);
    expect([e.localizacao.tentativas.length, e.localizacao.fator]).toEqual([2, 0.3]);
  });
});

describe("reconstruirEstado: edições e prechecks (S3-07)", () => {
  it("conta os prechecks e guarda o último", () => {
    const e = reconstruirEstado([loc(4, true, 1),
      { tipo: "precheck", payload: { resultado: "falhou", obtido: "3", numero_uso: 1 } },
      { tipo: "precheck", payload: { resultado: "tempo_excedido", obtido: null, numero_uso: 2 } }]);
    expect(e.prechecks).toEqual({ usados: 2, ultimo: { resultado: "tempo_excedido", obtido: null, numero_uso: 2 } });
  });
  it("o código atual é o do último editou", () => {
    const e = reconstruirEstado([loc(4, true, 1), { tipo: "editou", payload: { codigo: "a", linhas_alteradas: 1 } },
      { tipo: "editou", payload: { codigo: "b", linhas_alteradas: 1 } }]);
    expect(e.codigoAtual).toBe("b");
  });
  it("sem editou, o código atual é null (vale o recebido)", () => {
    expect(reconstruirEstado([]).codigoAtual).toBeNull();
  });
});

describe("reconstruirEstado: Verificar e encerramento (S4-02)", () => {
  it("guarda os Verificar na ordem e o encerramento", () => {
    const e = reconstruirEstado([loc(4, true, 1),
      { tipo: "verificar", payload: { resultado: "falhou", passados: 3, total: 5 } },
      { tipo: "verificar", payload: { resultado: "passou", passados: 5, total: 5 } },
      { tipo: "encerrou", payload: { desfecho: "resolvido" } }]);
    expect(e.verificacoes).toEqual([{ resultado: "falhou", passados: 3, total: 5 }, { resultado: "passou", passados: 5, total: 5 }]);
    expect(e.encerrada).toEqual({ desfecho: "resolvido" });
  });
  it("sem eventos: nenhum Verificar, aberta", () => {
    expect([reconstruirEstado([]).verificacoes, reconstruirEstado([]).encerrada]).toEqual([[], null]);
  });
});

describe("máquina de estados do editor (S3-04)", () => {
  const inicial = reconstruirEstado([]);
  it("acerto na 1ª destrava", () => {
    const e = reduzir(inicial, { tipo: "localizou", linha: 4, correta: true });
    expect([e.editorLiberado, e.localizacao.fator]).toEqual([true, 1.0]);
  });
  it("erro mantém travado; o segundo erro destrava", () => {
    const um = reduzir(inicial, { tipo: "localizou", linha: 6, correta: false });
    expect(um.editorLiberado).toBe(false);
    const dois = reduzir(um, { tipo: "localizou", linha: 2, correta: false });
    expect([dois.editorLiberado, dois.localizacao.fator]).toEqual([true, 0.3]);
  });
  it("depois de concluída, novas localizações não mudam nada", () => {
    const e = reduzir(inicial, { tipo: "localizou", linha: 4, correta: true });
    expect(reduzir(e, { tipo: "localizou", linha: 1, correta: false })).toBe(e);
  });
  it("carregar substitui o estado pelo reconstruído no servidor", () => {
    const servidor = reconstruirEstado([loc(6, false, 1), loc(4, true, 2)]);
    expect(reduzir(inicial, { tipo: "carregou", estado: servidor })).toEqual(servidor);
  });
  it("precheck registrado atualiza o contador com o número do servidor", () => {
    const e = reduzir(inicial, { tipo: "precheck", uso: { resultado: "passou", obtido: "8.0", numero_uso: 2 } });
    expect(e.prechecks).toEqual({ usados: 2, ultimo: { resultado: "passou", obtido: "8.0", numero_uso: 2 } });
  });
  it("verificou sem sucesso acumula; com sucesso encerra, e depois nada muda", () => {
    const um = reduzir(inicial, { tipo: "verificou", resultado: { resultado: "falhou", passados: 1, total: 3 }, encerrada: false });
    expect([um.verificacoes.length, um.encerrada]).toEqual([1, null]);
    const dois = reduzir(um, { tipo: "verificou", resultado: { resultado: "passou", passados: 3, total: 3 }, encerrada: true });
    expect(dois.encerrada).toEqual({ desfecho: "resolvido" });
    expect(reduzir(dois, { tipo: "verificou", resultado: { resultado: "falhou", passados: 0, total: 3 }, encerrada: false })).toBe(dois);
  });
  it("dica registrada entra uma vez só", () => {
    const e = reduzir(reduzir(inicial, { tipo: "dica", nivel: 1 }), { tipo: "dica", nivel: 1 });
    expect(e.dicasUsadas).toEqual([1]);
  });
  it("editou guarda o código atual", () => {
    expect(reduzir(inicial, { tipo: "editou", codigo: "x" }).codigoAtual).toBe("x");
  });
});

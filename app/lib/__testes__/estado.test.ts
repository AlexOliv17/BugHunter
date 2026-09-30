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
});

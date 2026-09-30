import { describe, expect, it } from "vitest";

import { situacaoDasDicas } from "../dicas";
import { reconstruirEstado } from "../estado";

const loc = (correta: boolean) => ({ tipo: "localizou", payload: { linha: 1, correta } });
const ver = (resultado: string) => ({ tipo: "verificar", payload: { resultado, passados: 0, total: 1 } });
const dica = (nivel: number) => ({ tipo: "dica", payload: { nivel } });
const situacoes = (eventos: { tipo: string; payload: Record<string, unknown> }[]) => {
  const s = situacaoDasDicas(reconstruirEstado(eventos));
  return [s[1].situacao, s[2].situacao, s[3].situacao];
};

describe("situacaoDasDicas (RF-12, espelho de solicitar_dica)", () => {
  it("editor travado: as três travadas, com motivo", () => {
    const s = situacaoDasDicas(reconstruirEstado([]));
    expect(situacoes([])).toEqual(["travada", "travada", "travada"]);
    expect(s[1]).toMatchObject({ motivo: expect.stringContaining("apontar a linha") });
  });
  it("destravado, sem Verificar: 1 disponível; 2 e 3 travadas", () => {
    expect(situacoes([loc(true)])).toEqual(["disponivel", "travada", "travada"]);
  });
  it("dica 1 usada, sem Verificar falho: 2 ainda travada", () => {
    expect(situacoes([loc(true), dica(1)])).toEqual(["usada", "travada", "travada"]);
  });
  it("Verificar falho sem a dica 1: 2 travada", () => {
    expect(situacoes([loc(true), ver("falhou")])).toEqual(["disponivel", "travada", "travada"]);
  });
  it("dica 1 e Verificar falho: 2 disponível; depois dela, a 3", () => {
    expect(situacoes([loc(true), dica(1), ver("tempo_excedido")])).toEqual(["usada", "disponivel", "travada"]);
    expect(situacoes([loc(true), dica(1), ver("erro"), dica(2)])).toEqual(["usada", "usada", "disponivel"]);
  });
  it("encerrada: as não usadas ficam travadas", () => {
    expect(situacoes([loc(true), dica(1), ver("passou"), { tipo: "encerrou", payload: { desfecho: "resolvido" } }]))
      .toEqual(["usada", "travada", "travada"]);
  });
});

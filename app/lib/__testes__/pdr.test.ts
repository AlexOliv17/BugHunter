import { describe, expect, it } from "vitest";

import { calcularPdr, componentesPdr } from "../pdr";

type E = { tipo: string; payload: Record<string, unknown> };
const loc = (linha: number, correta: boolean): E => ({ tipo: "localizou", payload: { linha, correta } });
const ver = (resultado: string): E => ({ tipo: "verificar", payload: { resultado, passados: 0, total: 5 } });
const dica = (nivel: number): E => ({ tipo: "dica", payload: { nivel } });
const MEDIO = { base: 200, numero_tentativa: 1 };
const BAIXO = { base: 100, numero_tentativa: 1 };

describe("calcularPdr (RN-05)", () => {
  it("exemplo trabalhado: 117", () => {
    // médio, 1ª tentativa; erra a linha 6, acerta a 4, dica 1, falha um Verificar e passa no segundo
    const eventos = [loc(6, false), loc(4, true), dica(1), ver("falhou"), ver("passou")];
    expect(calcularPdr(eventos, MEDIO)).toBe(117);
  });

  it("perfeito: base cheia", () => {
    expect(calcularPdr([loc(4, true), ver("passou")], MEDIO)).toBe(200);
    expect(calcularPdr([loc(4, true), ver("passou")], BAIXO)).toBe(100);
  });

  it("empate 42,5 → 43, meio-para-cima (D-16)", () => {
    // baixo, 2ª tentativa, localização na 1ª, dica 1, Verificar de primeira: 100 × 1,0 × 0,85 × 0,5 = 42,5
    expect(calcularPdr([loc(4, true), dica(1), ver("passou")], { base: 100, numero_tentativa: 2 })).toBe(43);
    // baixo, 2ª tentativa, localização na 1ª, um Verificar falho: 100 × (0,4 + 0,45) × 0,5 = 42,5
    expect(calcularPdr([loc(4, true), ver("erro"), ver("passou")], { base: 100, numero_tentativa: 2 })).toBe(43);
  });

  describe("componente: localização (RN-01)", () => {
    it("1ª = 1,0; 2ª = 0,6; dois erros = 0,3", () => {
      expect(componentesPdr([loc(4, true)], MEDIO).fatorLocalizacao).toBe(1.0);
      expect(componentesPdr([loc(1, false), loc(4, true)], MEDIO).fatorLocalizacao).toBe(0.6);
      expect(componentesPdr([loc(1, false), loc(2, false)], MEDIO).fatorLocalizacao).toBe(0.3);
    });
    it("não concluída: 0,3 (D-17), sem evento ou com um único incorreto", () => {
      expect(componentesPdr([], MEDIO).fatorLocalizacao).toBe(0.3);
      expect(componentesPdr([loc(1, false)], MEDIO).fatorLocalizacao).toBe(0.3);
      expect(calcularPdr([], BAIXO)).toBe(72); // 100 × (0,12 + 0,6)
    });
    it("localizações além das duas primeiras não contam", () => {
      expect(componentesPdr([loc(1, false), loc(2, false), loc(4, true)], MEDIO).fatorLocalizacao).toBe(0.3);
    });
  });

  describe("componente: reparo (RN-03)", () => {
    const reparo = (...v: string[]) => componentesPdr([loc(4, true), ...v.map(ver)], MEDIO).fatorReparo;
    it("−0,25 por Verificar sem sucesso, qualquer que seja o motivo (D-09)", () => {
      expect(reparo("passou")).toBe(1.0);
      expect(reparo("falhou", "passou")).toBe(0.75);
      expect(reparo("tempo_excedido", "erro", "passou")).toBe(0.5);
    });
    it("piso em 0", () => {
      const eventos = [loc(4, true), ...Array.from({ length: 6 }, () => ver("falhou"))];
      expect(componentesPdr(eventos, MEDIO).fatorReparo).toBe(0);
      expect(calcularPdr(eventos, MEDIO)).toBe(80); // 200 × 0,4
    });
  });

  describe("componente: dica (RN-04)", () => {
    const mult = (...n: number[]) => componentesPdr(n.map(dica), MEDIO).multiplicadorDica;
    it("vale o maior nível usado, não cumulativo", () => {
      expect(mult()).toBe(1.0);
      expect(mult(1)).toBe(0.85);
      expect(mult(1, 2)).toBe(0.65);
      expect(mult(1, 2, 3)).toBe(0.4);
    });
    it("nível fora de 1–3 é ignorado", () => {
      expect(mult(7)).toBe(1.0);
    });
  });

  it("componente: repetição vale metade (RN-07)", () => {
    expect(calcularPdr([loc(4, true), ver("passou")], { base: 200, numero_tentativa: 3 })).toBe(100);
  });

  it("desistência: 0 (RN-06)", () => {
    expect(calcularPdr([loc(4, true), { tipo: "encerrou", payload: { desfecho: "desistiu" } }], MEDIO)).toBe(0);
  });

  it("é pura: mesma entrada, mesmo resultado, sem alterar os eventos", () => {
    const eventos = [loc(6, false), loc(4, true), dica(1), ver("falhou"), ver("passou")];
    const copia = structuredClone(eventos);
    expect(calcularPdr(eventos, MEDIO)).toBe(calcularPdr(eventos, MEDIO));
    expect(eventos).toEqual(copia);
  });

  it("todas as combinações batem com a conta exata", () => {
    // referência independente, em inteiros: base × (40·loc + 60·reparo) × dica × repetição / 10^8
    const localizacoes: [number, E[]][] = [[100, [loc(1, true)]], [60, [loc(2, false), loc(1, true)]], [30, []]];
    for (const base of [100, 200])
      for (const [l, eventosLoc] of localizacoes)
        for (let falhas = 0; falhas <= 4; falhas++)
          for (const d of [0, 1, 2, 3])
            for (const n of [1, 2]) {
              const eventos = [...eventosLoc, ...Array.from({ length: falhas }, () => ver("falhou")), ...(d ? [dica(d)] : [])];
              const rep = Math.max(0, 100 - 25 * falhas), md = [100, 85, 65, 40][d], mr = n > 1 ? 50 : 100;
              const num = base * (40 * l + 60 * rep) * md * mr, den = 10 ** 8;
              expect(calcularPdr(eventos, { base, numero_tentativa: n })).toBe(Math.floor((2 * num + den) / (2 * den)));
            }
  });
});

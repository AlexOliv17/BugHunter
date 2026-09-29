import { describe, expect, it } from "vitest";

import { destinoSeguro, ehDeAcesso, ehProtegida } from "../rotas";

describe("rotas protegidas (RF-02)", () => {
  it("temas e exercícios exigem login", () => {
    for (const c of ["/temas", "/temas/fundamentos", "/exercicio", "/exercicio/abc"]) expect(ehProtegida(c)).toBe(true);
  });
  it("login, cadastro e outras rotas não são protegidas", () => {
    for (const c of ["/login", "/cadastro", "/", "/temasx", "/api/saude"]) expect(ehProtegida(c)).toBe(false);
  });
  it("reconhece as telas de acesso", () => {
    expect(ehDeAcesso("/login")).toBe(true);
    expect(ehDeAcesso("/cadastro")).toBe(true);
    expect(ehDeAcesso("/loginx")).toBe(false);
  });
});

describe("destinoSeguro", () => {
  it("volta para a rota protegida pedida", () => {
    expect(destinoSeguro("/exercicio/abc")).toBe("/exercicio/abc");
    expect(destinoSeguro("/temas/fundamentos?nivel=medio")).toBe("/temas/fundamentos?nivel=medio");
  });
  it("recusa destinos externos ou estranhos e cai em /temas", () => {
    for (const d of ["https://malicioso.com", "//malicioso.com", "/\malicioso.com", "/login", "/cadastro", "", null, 42])
      expect(destinoSeguro(d)).toBe("/temas");
  });
});

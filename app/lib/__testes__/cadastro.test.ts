import { describe, expect, it } from "vitest";

import { mensagemDoErro, normalizar, validarCadastro } from "../cadastro";

const valido = { nome: "Ana", email: "ana@exemplo.com", senha: "12345678" };

describe("validarCadastro (RF-01)", () => {
  it("aceita nome, e-mail válido e senha de 8 caracteres", () => {
    expect(validarCadastro(valido)).toEqual({});
  });
  it("recusa senha com menos de 8 caracteres", () => {
    expect(validarCadastro({ ...valido, senha: "1234567" }).senha).toMatch(/8 caracteres/);
  });
  it("recusa e-mail inválido", () => {
    for (const email of ["", "ana", "ana@", "ana@exemplo", "a na@x.com"])
      expect(validarCadastro({ ...valido, email }).email).toBeDefined();
  });
  it("recusa nome vazio ou só espaços", () => {
    expect(validarCadastro(normalizar({ ...valido, nome: "   " })).nome).toBeDefined();
  });
  it("aponta todos os erros de uma vez", () => {
    expect(Object.keys(validarCadastro({ nome: "", email: "x", senha: "" })).sort()).toEqual(["email", "nome", "senha"]);
  });
});

describe("normalizar", () => {
  it("apara espaços e põe o e-mail em minúsculas, sem mexer na senha", () => {
    expect(normalizar({ nome: " Ana ", email: " Ana@Exemplo.COM ", senha: " s3nha " }))
      .toEqual({ nome: "Ana", email: "ana@exemplo.com", senha: " s3nha " });
  });
});

describe("mensagemDoErro", () => {
  it("informa o e-mail já cadastrado (RF-01)", () => {
    expect(mensagemDoErro("user_already_exists")).toMatch(/já existe uma conta/i);
    expect(mensagemDoErro("email_exists")).toMatch(/já existe uma conta/i);
  });
  it("tem mensagem genérica para o resto", () => {
    expect(mensagemDoErro("qualquer_outro")).toMatch(/não foi possível criar a conta/i);
    expect(mensagemDoErro(undefined)).toMatch(/não foi possível criar a conta/i);
  });
});

import { describe, expect, it } from "vitest";

import { iniciais, nomeDe } from "../nome";

describe("nome do aluno no cabeçalho", () => {
  it("usa o nome do cadastro e cai no e-mail se faltar", () => {
    expect(nomeDe({ email: "a@x.com", user_metadata: { nome: " Ana Souza " } })).toBe("Ana Souza");
    expect(nomeDe({ email: "a@x.com", user_metadata: {} })).toBe("a@x.com");
  });
  it("iniciais do primeiro e do último nome", () => {
    expect(iniciais("Alex Oliveira")).toBe("AO");
    expect(iniciais("ana maria souza")).toBe("AS");
    expect(iniciais("Ana")).toBe("A");
    expect(iniciais("  ")).toBe("?");
  });
});

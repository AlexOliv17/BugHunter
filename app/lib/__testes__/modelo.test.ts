import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { gerarTexto, ModeloIndisponivel, modelosConfigurados } from "../modelo";

const ENTRADA = { instrucoes: "i", texto: "t" };
const resposta = (status: number, texto?: string) =>
  new Response(JSON.stringify(texto === undefined ? {} : { candidates: [{ content: { parts: [{ text: texto }] } }] }), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("modelo do feedback (RF-15)", () => {
  it("lista de modelos: separa por vírgula e ignora nomes inválidos", () => {
    expect(modelosConfigurados(" a-1.5 , b ,, c/d ")).toEqual(["a-1.5", "b"]);
  });
  it("sem chave ou sem modelo: indisponível, sem chamar a rede", async () => {
    const rede = vi.fn();
    vi.stubGlobal("fetch", rede);
    vi.stubEnv("FEEDBACK_API_KEY", "");
    vi.stubEnv("FEEDBACK_MODEL", "m");
    await expect(gerarTexto(ENTRADA)).rejects.toThrow(ModeloIndisponivel);
    expect(rede).not.toHaveBeenCalled();
  });
  it("o primeiro modelo sobrecarregado: tenta o próximo", async () => {
    vi.stubEnv("FEEDBACK_API_KEY", "k");
    vi.stubEnv("FEEDBACK_MODEL", "lento,rapido");
    const rede = vi.fn().mockResolvedValueOnce(resposta(503)).mockResolvedValueOnce(resposta(200, "texto do segundo"));
    vi.stubGlobal("fetch", rede);
    expect(await gerarTexto(ENTRADA)).toBe("texto do segundo");
    expect(rede.mock.calls.map((c) => String(c[0]).match(/models\/(.+):/)?.[1])).toEqual(["lento", "rapido"]);
  });
  it("com outro modelo na fila, o primeiro tem no máximo 8 s; o último, o que resta dos 15 s", async () => {
    vi.stubEnv("FEEDBACK_API_KEY", "k");
    vi.stubEnv("FEEDBACK_MODEL", "a,b");
    const limites: number[] = [];
    vi.stubGlobal("AbortSignal", { timeout: (ms: number) => (limites.push(ms), undefined) });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(resposta(503)).mockResolvedValueOnce(resposta(200, "ok")));
    await gerarTexto(ENTRADA);
    expect(limites[0]).toBe(8000);
    expect(limites[1]).toBeGreaterThan(14000);
  });
  it("a chave vai no cabeçalho, nunca na URL", async () => {
    vi.stubEnv("FEEDBACK_API_KEY", "chave-secreta");
    vi.stubEnv("FEEDBACK_MODEL", "m");
    const rede = vi.fn().mockResolvedValue(resposta(200, "ok"));
    vi.stubGlobal("fetch", rede);
    await gerarTexto(ENTRADA);
    expect(String(rede.mock.calls[0][0])).not.toContain("chave-secreta");
    expect(rede.mock.calls[0][1].headers["x-goog-api-key"]).toBe("chave-secreta");
  });
  it("todos falham ou devolvem vazio: indisponível", async () => {
    vi.stubEnv("FEEDBACK_API_KEY", "k");
    vi.stubEnv("FEEDBACK_MODEL", "a,b");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(resposta(200, "  ")).mockRejectedValueOnce(new Error("rede")));
    await expect(gerarTexto(ENTRADA)).rejects.toThrow(/a: texto vazio; b: inacessível/);
  });
});

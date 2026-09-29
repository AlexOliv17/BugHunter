// Regras de roteamento de acesso (RF-02). Funções puras, usadas pelo proxy e pelas páginas.

export const DESTINO_APOS_ENTRAR = "/temas";

const PROTEGIDAS = ["/temas", "/exercicio"];
const DE_ACESSO = ["/login", "/cadastro"];

const casa = (caminho: string, prefixo: string) => caminho === prefixo || caminho.startsWith(prefixo + "/");

export const ehProtegida = (caminho: string) => PROTEGIDAS.some((p) => casa(caminho, p));
export const ehDeAcesso = (caminho: string) => DE_ACESSO.some((p) => casa(caminho, p));

// Só aceita caminhos internos: evita que ?proximo= leve o aluno para outro site.
export function destinoSeguro(proximo: unknown): string {
  if (typeof proximo !== "string" || !proximo.startsWith("/") || proximo.startsWith("//") || proximo.includes("\\")) {
    return DESTINO_APOS_ENTRAR;
  }
  return ehProtegida(proximo.split("?")[0]) ? proximo : DESTINO_APOS_ENTRAR;
}

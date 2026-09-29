// Regras do cadastro (RF-01). Funções puras, usadas no formulário e na ação do servidor.

export const SENHA_MINIMA = 8;

export type DadosCadastro = { nome: string; email: string; senha: string };
export type ErrosCadastro = Partial<Record<keyof DadosCadastro, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizar(bruto: { nome?: unknown; email?: unknown; senha?: unknown }): DadosCadastro {
  return {
    nome: String(bruto.nome ?? "").trim(),
    email: String(bruto.email ?? "").trim().toLowerCase(),
    senha: String(bruto.senha ?? ""),
  };
}

export function validarCadastro(dados: DadosCadastro): ErrosCadastro {
  const erros: ErrosCadastro = {};
  if (!dados.nome) erros.nome = "Informe seu nome.";
  if (!EMAIL.test(dados.email)) erros.email = "Informe um e-mail válido.";
  if (dados.senha.length < SENHA_MINIMA) erros.senha = `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`;
  return erros;
}

// Tradução dos erros do Supabase Auth. No cadastro, o RF-01 pede que o e-mail
// repetido seja informado; o login (RF-02) usará mensagem genérica.
export function mensagemDoErro(codigo: string | undefined): string {
  switch (codigo) {
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com este e-mail. Entre com ela ou use outro e-mail.";
    case "weak_password":
      return `A senha é fraca demais. Use ao menos ${SENHA_MINIMA} caracteres, misturando letras e números.`;
    case "email_address_invalid":
      return "Informe um e-mail válido.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
    default:
      return "Não foi possível criar a conta agora. Tente de novo em instantes.";
  }
}

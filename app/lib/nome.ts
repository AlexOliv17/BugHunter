// Nome de exibição e iniciais do aluno, para o cabeçalho.

export function nomeDe(usuario: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const nome = usuario.user_metadata?.nome;
  return typeof nome === "string" && nome.trim() ? nome.trim() : (usuario.email ?? "");
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

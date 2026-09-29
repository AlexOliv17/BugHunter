// Cards da tela de temas (RF-03). A leitura usa só o que o cliente pode ver:
// a view temas_publicos e a função de agregado progresso_por_tema() (D-20).

export type TemaPublico = { codigo: string; nome: string; descricao: string; ativo: boolean; ordem: number };
export type ProgressoTema = { tema_codigo: string; total: number | string; resolvidos: number | string };

export type CardTema = TemaPublico & { total: number; resolvidos: number; porcentagem: number };

export function montarCards(temas: TemaPublico[], progresso: ProgressoTema[]): CardTema[] {
  const porTema = new Map(progresso.map((p) => [p.tema_codigo, p]));
  return [...temas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((tema) => {
      const p = porTema.get(tema.codigo);
      // count() do Postgres chega como texto pela API; o tema sem exercícios não aparece no agregado
      const total = Number(p?.total ?? 0);
      const resolvidos = Number(p?.resolvidos ?? 0);
      const porcentagem = total ? Math.round((resolvidos / total) * 100) : 0;
      return { ...tema, total, resolvidos, porcentagem };
    });
}

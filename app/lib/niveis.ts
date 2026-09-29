// Níveis de dificuldade (RF-04). A pontuação-base vem da RN-05.

export const BASE_POR_NIVEL = { baixo: 100, medio: 200 } as const;
export type Nivel = keyof typeof BASE_POR_NIVEL;

export type NivelDoTema = { nivel: string; categorias: string[] | null; total: number | string; resolvidos: number | string };

export type CardNivel = {
  nivel: Nivel;
  titulo: string;
  descricao: string;
  base: number;
  categorias: string[];
  total: number;
  resolvidos: number;
};

// Textos dos cards, do protótipo "Dificuldade" do P.O.
const APRESENTACAO: Record<Nivel, { titulo: string; descricao: string }> = {
  baixo: { titulo: "Baixo", descricao: "O defeito é visível numa única linha, sem precisar simular a execução." },
  medio: { titulo: "Médio", descricao: "Exige acompanhar o fluxo do laço para perceber o que não fecha." },
};

export const ehNivel = (valor: unknown): valor is Nivel => valor === "baixo" || valor === "medio";

export function montarNiveis(linhas: NivelDoTema[]): CardNivel[] {
  const porNivel = new Map(linhas.map((l) => [l.nivel, l]));
  return (Object.keys(BASE_POR_NIVEL) as Nivel[]).map((nivel) => {
    const l = porNivel.get(nivel);
    return {
      nivel,
      ...APRESENTACAO[nivel],
      base: BASE_POR_NIVEL[nivel],
      categorias: [...(l?.categorias ?? [])].sort((a, b) => a.localeCompare(b, "pt-BR")),
      total: Number(l?.total ?? 0),
      resolvidos: Number(l?.resolvidos ?? 0),
    };
  });
}

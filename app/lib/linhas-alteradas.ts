// Contagem de linhas alteradas (RN-08, S3-05): diff linha a linha contra o
// codigo_com_defeito que o aluno recebeu — nunca contra o código correto.
// Cada linha modificada, inserida ou removida conta 1: num trecho alterado, uma
// remoção e uma inserção pareadas são uma linha modificada.

export const LIMITE_ALERTA = 3; // alerta visual acima de 3; informativo, não bloqueia (D-02)

type Trecho = { removidas: number; inseridas: number; primeiraInserida: number };

function trechos(original: string[], atual: string[]): Trecho[] {
  const n = original.length, m = atual.length;
  // lcs[i][j]: maior subsequência comum de original[i..] e atual[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = original[i] === atual[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const resultado: Trecho[] = [];
  let atualTrecho: Trecho | null = null;
  let i = 0, j = 0;
  const fechar = () => { if (atualTrecho) resultado.push(atualTrecho); atualTrecho = null; };
  const abrir = () => (atualTrecho ??= { removidas: 0, inseridas: 0, primeiraInserida: j });
  while (i < n || j < m) {
    if (i < n && j < m && original[i] === atual[j]) { fechar(); i++; j++; }
    else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) { abrir().inseridas++; j++; }
    else { abrir().removidas++; i++; }
  }
  fechar();
  return resultado;
}

const dividir = (codigo: string) => codigo.replace(/\r\n/g, "\n").split("\n");

export function contarLinhasAlteradas(original: string, atual: string): number {
  return trechos(dividir(original), dividir(atual)).reduce((soma, t) => soma + Math.max(t.removidas, t.inseridas), 0);
}

// Linhas do código atual (1-indexadas) que são novas ou modificadas, para marcar no editor.
export function linhasMarcadas(original: string, atual: string): number[] {
  const marcadas: number[] = [];
  for (const t of trechos(dividir(original), dividir(atual)))
    for (let k = 0; k < t.inseridas; k++) marcadas.push(t.primeiraInserida + k + 1);
  return marcadas;
}

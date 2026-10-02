# S6-04 · Tempos de resposta (RNF-02)

Data: 2026-10-02 · Medido de fora, de Minas Gerais, sem login, com `node app/scripts/medir-tempos.mjs`.

## 1. Achado: a função e o banco estavam em continentes diferentes

| Peça | Região |
|---|---|
| Banco (Supabase) | `sa-east-1`, São Paulo |
| Funções da aplicação (Vercel) | `iad1`, Washington, EUA (padrão da Vercel) |
| Funções do executor (Vercel) | `iad1` |
| Borda da Vercel que atende o aluno | `gru1`, São Paulo |

Cada consulta ao banco ia de Washington a São Paulo e voltava. Medição antes do ajuste:

| Chamada | Mediana | p90 |
|---|---|---|
| `/login` (página) | 193 ms | 248 ms |
| `/api/saude` (2 consultas ao banco, em paralelo) | 563–619 ms | 636–696 ms |
| executor, GET (sem execução) | 145–207 ms | 175–363 ms |

O Verificar faz, em sequência, a autenticação, cerca de cinco consultas ao banco e a chamada ao executor; a tela
de exercício, a autenticação e três consultas. Com cada ida ao banco custando algumas centenas de milissegundos,
as duas operações ficavam perto ou acima dos alvos de 1,5 s e 2 s.

## 2. Ajustes

1. **Região das funções:** `"regions": ["gru1"]` em `app/vercel.json` e `executor/vercel.json`. Aplicação,
   executor e banco ficam em São Paulo, junto da borda que atende o aluno. O plano Hobby permite escolher uma região.
2. **Consultas em paralelo:** em `/api/tentativa`, eventos e dicas são lidos juntos; em `/api/verificar`, o registro
   do código (`editou`) e a leitura da suíte correm juntos. O `editou` continua gravado antes do `verificar` (RN-12).

## 3. Situação por meta

| Operação | Alvo · teto | Situação |
|---|---|---|
| carregar a tela de exercício | 1,5 s · 3 s | página ~0,2 s + `/api/tentativa`; com as funções em São Paulo, cada consulta passa a custar dezenas de ms, não centenas |
| Precheck | 1 s · 2 s (rígido) | no navegador: execução de 2 a 17 ms (S0-06), com o Pyodide carregado na abertura da tela, fora do relógio (decisão 1.7); corte rígido aos 2 s |
| Verificar | 2 s · 5 s (rígido) | executor quente ~0,2–0,3 s, a frio ~1 s (S0-04); suíte limitada a 5 s; mais as consultas ao banco, agora na mesma região |
| gerar o feedback | 5 s · 15 s | `gemini-3.1-flash-lite`: 2 a 3 s nas medições da S5-02; reserva ao passar de 15 s, com um segundo modelo tentado dentro do prazo |

## 4. A conferir depois do deploy

1. Rodar `node app/scripts/medir-tempos.mjs`: a região deve aparecer como `gru1::gru1`, e `/api/saude` deve cair
   bem abaixo dos ~600 ms medidos antes.
2. Com login, na aba Rede: o tempo de `POST /api/tentativa` ao abrir um exercício e de `POST /api/verificar`.

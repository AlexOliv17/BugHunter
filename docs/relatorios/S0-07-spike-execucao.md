# S0-07 · Relatório do spike de execução de código

Data: 2026-09-29 · Ambiente: Vercel (plano Hobby), produção em `bug-hunter-alpha.vercel.app`.
Atividades de origem: S0-04 (rota A), S0-05 (rota B), S0-06 (Precheck no navegador).

Todos os spikes rodaram apenas casos fixos definidos no código, sem aceitar código enviado pelo cliente,
e responderam só contagens, tempos e booleanos.

## 1. Resultado por rota

| Critério | Rota A — Python + subprocess | Rota B — Pyodide no Node | Precheck — Pyodide no navegador |
|---|---|---|---|
| Funcionou na Vercel | sim (arquivo em `app/api/`, Python 3.12) | sim (thread `worker_threads`, `pyodide` externo) | sim (Web Worker módulo, Pyodide servido pelo próprio domínio) |
| Partida a frio, ponta a ponta | ~1,0 s | **4,2–5,5 s** (carga do Pyodide 3,6–4,8 s) | carga 4,2–6,9 s, fora do relógio (decisão 1.7) |
| Resposta com instância quente | ~200–300 ms (execução 26–40 ms) | ~175–350 ms (execução 3–21 ms) | execução 2–17 ms |
| Laço infinito | `tempo_excedido` aos 5,0 s | `tempo_excedido` aos 5,0 s; recarga de ~4,5 s depois | `tempo_excedido` aos 2,0 s; recriar o worker custa ~3,6–4,2 s |
| Memória sem limite | **contido**: limite de 256 MB encerra só o filho | **derruba a instância inteira** (HTTP 500) | fica no navegador do aluno |
| Escrita em disco | só na pasta temporária | não testado (spike funcional) | — |
| Isolamento de credenciais | **falhou**: o filho lê a chave de serviço em `/proc/<pai>/environ` | **não verificado** (adiado, ver §3) | não se aplica: o navegador não tem credenciais |
| Maturidade na Vercel | funções Python em `/api` são mantidas "para projetos existentes"; o caminho novo (Services) está em beta | estável | estável |

## 2. Análise

**RNF-02 (Verificar: alvo 2 s, teto rígido 5 s).** A rota B estoura o teto na partida a frio, porque só a carga do
Pyodide consome de 3,6 a 4,8 s. A rota A fica em ~1 s mesmo a frio.

**RF-11 / RNF-05 (disponibilidade).** Na rota B, uma submissão que consome memória derruba a instância. Como a Vercel
reaproveita a mesma instância para requisições simultâneas, isso afeta os Verificar de outros alunos em andamento.
Na rota A, o limite do sistema operacional encerra só o processo do aluno.

**RF-11 / RNF-05 (credenciais).** Na rota A, `env={}` não basta. A Vercel injeta todas as variáveis do projeto em
todas as funções, e o processo do aluno lê as do processo pai. A causa é a presença das credenciais no processo que
executa o código, não o mecanismo de execução. Portanto a correção é arquitetural: o executor não pode ter nenhuma
credencial.

## 3. Recomendação

**Rota A em projeto Vercel separado, sem nenhuma variável de ambiente (rota A').**

- O executor Python fica num segundo projeto Vercel, sem chave do Supabase nem do modelo. O servidor Next.js busca a
  suíte e o código no banco e chama o executor por HTTPS.
- O executor exige um segredo compartilhado no cabeçalho, para que só o nosso servidor o use. Esse segredo concede
  apenas o que o executor já faz, que é executar código isolado.
- Em relação à rota A atual, mantém a partida a frio de ~1 s e os limites de memória, tempo e disco já comprovados,
  e elimina a exposição da chave por construção.
- Custo: um segundo projeto no plano gratuito (RNF-01 preservado) e uma chamada HTTPS a mais por Verificar.

Isso contraria a preferência pela rota B registrada na Documentação §4.3. A preferência se apoiava no isolamento da
sandbox WASM, mas as medições mostraram que a rota B viola o teto de tempo e a disponibilidade, e o isolamento dela
não foi verificado.

A verificação completa de isolamento da rota escolhida fica na S4-07, como previsto no plano.

## 4. Riscos que valem para qualquer rota (tratar na S4-01)

1. **Exposição da suíte oculta durante a execução.** A suíte roda no mesmo processo que o código do aluno. Se o
   ambiente de execução permitir saída de rede, o conteúdo da suíte pode ser enviado para fora. Mitigação a
   desenhar na S4-01: o processo do aluno recebe só as entradas dos testes, nunca os valores esperados, e a
   comparação acontece fora dele. Também avaliar o bloqueio de rede no executor.
2. **Classificação de exceções.** Hoje uma exceção durante um teste conta como teste falho ("falhou"); só a exceção
   ao carregar o código vira "erro". Confirmar a regra com o P.O. na S4-01.
3. **Cache dos arquivos do Pyodide.** A Vercel serve com `max-age=0`. Na S3-06, configurar cache longo, já que o
   caminho identifica a versão.

## 5. Limpeza

Depois da decisão, os spikes serão removidos: `app/api/spike_rota_a.py`, `app/app/api/spike_rota_b/`,
`app/spike/`, `app/app/spike/`, `app/public/spike/` e a configuração correspondente no `next.config.ts`.
A rota escolhida é reimplementada na S4-01. O script `copiar-pyodide.mjs` fica, porque serve ao Precheck.

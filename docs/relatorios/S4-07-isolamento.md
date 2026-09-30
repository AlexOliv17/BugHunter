# S4-07 · Teste de isolamento do executor (RF-11, RNF-05)

Data: 2026-09-30 · Alvo: `https://bughunter-executor.vercel.app/api/executar` (projeto Vercel separado, DA-08).
Rodado pelo P.O. com `executor/tests/isolamento_remoto.py`. As sondas devolvem só contagens e sim/não;
nenhum valor de variável foi lido. Repetir na S6-02 sobre a versão publicada.

| Sonda | Observado | Leitura |
|---|---|---|
| Segredo errado | HTTP 401 | ok: só o servidor da aplicação chama o executor |
| Variáveis no processo do aluno | 1, nenhuma com nome suspeito | ok: é a `LC_CTYPE` que o próprio Python cria quando nasce sem locale (PEP 538). O script agora lista os nomes, para a S6-02 confirmar |
| Ambiente do processo pai | legível | limitação conhecida desde a S0-04. Neste projeto ele só tem `EXECUTOR_SEGREDO`, que serve apenas para chamar o próprio executor |
| Escrita na pasta temporária própria | permitida | ok: área descartável, apagada ao fim |
| Escrita no código da função (`/var/task`) e na raiz | negada | ok |
| Escrita em `/tmp` da instância | permitida | informativo: área temporária da instância |
| Arquivo de 2 MB | negado | ok: teto de 1 MB por arquivo |
| Esgotar memória | exceção `MemoryError` em 0,6 s | ok: o teto de 256 MB contém a alocação; o Verificar trata como `erro` |
| Chamada normal depois da memória | respondeu | ok: o serviço não caiu |
| Laço infinito | `tempo_excedido` em 5,3 s | ok (RN-03) |
| Chamada normal depois do laço | respondeu | ok |
| Processo que tenta sobreviver | encerrado com o grupo | ok |

Os dois "ALERTA" da primeira execução eram expectativas erradas do script (a `LC_CTYPE` e a contenção
por `MemoryError` em vez de morte do processo), não falhas de isolamento. O script foi corrigido.

**Limitações conhecidas** (vão para o README na S6-05):
- o processo do aluno consegue abrir o ambiente do processo pai, que só contém `EXECUTOR_SEGREDO`;
- execuções simultâneas na mesma instância poderiam ver os arquivos temporários umas das outras
  enquanto existem (frações de segundo);
- o acesso de saída à rede a partir do processo do aluno não foi testado; mesmo que exista, não há
  nada no executor para exfiltrar. Sonda registrada para a S6-02.

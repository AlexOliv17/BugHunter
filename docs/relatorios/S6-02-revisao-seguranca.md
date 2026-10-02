# S6-02 · Revisão de segurança da versão publicada (RNF-03, RNF-04, RNF-05)

Data: 2026-10-02 · Produção: `bug-hunter-alpha.vercel.app` (main com as sprints 1 a 5) ·
Executor: `bughunter-executor.vercel.app`. Repete as auditorias de S1-04, S3-08 e S4-07.

As três verificações viraram scripts, para serem repetidas a cada publicação:

| Script | O que verifica | Resultado |
|---|---|---|
| `node supabase/testes/auditoria-producao.mjs` | banco publicado: privilégios pelo catálogo, RLS, e tentativas reais de acesso direto com a chave pública | 38 verificações, 0 alertas |
| `node app/scripts/auditoria-publicada.mjs` | aplicação publicada: rotas sem login, telas logadas sem login, HTML e JavaScript entregues ao navegador, build local | 21 verificações, 0 alertas |
| `python executor/tests/isolamento_remoto.py <url>` | executor publicado: ambiente, arquivos, memória, laço, processos, saída de rede | ver §3 |

## 1. Banco (S1-04, S3-08, RNF-03, RNF-04)

- `anon`: nenhuma tabela, coluna ou função.
- `authenticated`: `SELECT` em `temas_publicos` e `usuarios`; `UPDATE` só em `usuarios.nome` (S1-04, D-24);
  `EXECUTE` só em `niveis_do_tema` e `progresso_por_tema`.
- Os quatro campos secretos são ilegíveis para os dois papéis. RLS ligado em `usuarios`, `tentativas` e `eventos`.
- Pela API REST com a chave pública: leitura das 9 tabelas e views negada (401), escrita em `eventos` e `tentativas`
  negada, e as 17 funções do servidor recusadas por falta de permissão. Como `authenticated` não tem grant em
  `tentativas` nem `eventos`, um aluno logado também não lê as tentativas de outro (RNF-04): o acesso a elas é só
  pelos endpoints, que filtram pelo usuário da sessão dentro das funções do banco.

## 2. Aplicação (S3-08, RNF-03)

- As 12 rotas da tentativa respondem 401 sem sessão; as 4 telas logadas redirecionam ao login.
- HTML de `/`, `/login`, `/cadastro` e os 9 scripts publicados: nenhuma credencial, nem `suite_oculta` ou
  `categoria_codigo`. O build local do mesmo código (20 pedaços de JavaScript, inclusive os das telas logadas) também.
- Com sessão, o P.O. conferiu na aba Rede, na S3, que `/api/tentativa`, `/api/localizar`, `/api/editou` e
  `/api/precheck` não trazem os campos secretos. Os endpoints acrescentados depois seguem a mesma regra:
  `/api/verificar` devolve só `resultado`, `passados`, `total` e o PDR; `/api/dica`, só o texto da dica liberada;
  `/api/gabarito` e `/api/feedback` respondem só para tentativa encerrada do próprio aluno (testado no banco).

## 3. Executor (S4-07, RNF-05)

O código do executor (`executor/api/executar.py`) não mudou desde a execução da S4-07 na Vercel (2026-09-30),
cujo resultado continua valendo: nenhuma credencial no processo do aluno; escrita só na área temporária; teto de
1 MB por arquivo; memória contida em 256 MB sem derrubar o serviço; laço cortado aos 5 s.

O script ganhou a sonda de saída de rede, pendente da S4-07. Localmente ela conecta; na Vercel, a resposta
esperada também é "conecta". É informativa: o executor não guarda nada que possa ser levado.

## 4. Limitações conhecidas (README, S6-05)

- O processo do aluno consegue abrir o ambiente do processo pai do executor, que só contém `EXECUTOR_SEGREDO`.
  Com ele, alguém poderia chamar o executor diretamente, o que só roda código sem acesso a nada.
- Execuções simultâneas na mesma instância do executor poderiam ver os arquivos temporários umas das outras
  enquanto existem (frações de segundo).
- O Precheck roda no navegador: o aluno pode rodar o teste de exemplo quantas vezes quiser por fora. O limite de 3
  vale para os usos registrados, que são os que aparecem.
- O aluno pode abrir tentativas para colecionar códigos com defeito; isso não expõe nenhum dos quatro campos.

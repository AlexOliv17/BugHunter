# S6-03 · Bateria de aceitação (RF-01 a RF-17)

Data: 2026-10-02 · Versão: `main` com as sprints 1 a 5 e as decisões D-29 a D-31.

Cada critério de aceite dos Requisitos, com a evidência que o cobre:

- **auto**: teste automatizado (`app` = vitest, 179 testes; `banco` = Postgres real, 87 testes;
  `executor` = 21 testes; `pipeline` = unittest)
- **prod**: conferido na versão publicada pelos scripts da S6-02 ou pela conferência de PDR (`app/scripts/conferir-pdr.test.ts`)
- **P.O.**: conferido pelo P.O. na tela, nas validações das sprints
- **código**: implementado e revisado, sem teste automatizado próprio
- **demo**: a conferir pelo P.O. na demonstração final (S6-06), roteiro no fim

| Situação | Critérios |
|---|---|
| total | 88 |
| coberto por auto, prod, código ou P.O. | 85 (13 deles também entram no roteiro da demonstração) |
| só pela demonstração | 3 (RF-01 e-mail duplicado; RF-02 sessão ao reabrir; RF-07 destaque ao passar o cursor) |
| divergente | 0 |

## RF-01 · Cadastro

| Critério | Evidência |
|---|---|
| nome, e-mail válido e senha ≥ 8 criam a conta e entram autenticado | auto (`cadastro.test.ts`: validação) · P.O. (S2-01) |
| e-mail já cadastrado: erro, sem duplicar | demo |
| acesso imediato, sem confirmação por e-mail (D-07) | P.O. (S2-01) |
| linha em `usuarios` com o mesmo `id` | auto (gatilho da migration 007, usado por todos os testes do banco) |

## RF-02 · Autenticação

| Critério | Evidência |
|---|---|
| credenciais corretas levam a Temas | P.O. (S2-02) |
| credenciais erradas: erro genérico, sem revelar se o e-mail existe | código (`login/acoes.ts`: uma mensagem só para qualquer falha) · demo |
| sessão continua ao fechar e reabrir o navegador | demo |
| sem sessão, rota de exercício leva ao login | prod (`auditoria-publicada.mjs`: 4 telas → 307 /login) |
| Sair encerra a sessão e volta ao login (D-28) | P.O. (S2-03) |

## RF-03 · Temas

| Critério | Evidência |
|---|---|
| todos os temas, na `ordem` (D-25) | auto (`temas.test.ts`) · P.O. (S2-04) |
| tema inativo marcado e não clicável | P.O. (S2-04) |
| resolvidos / total do tema | auto (`temas.test.ts`, `progresso_por_tema`) · demo (conferir depois de resolver) |

## RF-04 · Nível

| Critério | Evidência |
|---|---|
| Baixo (100) e Médio (200) | auto (`niveis.test.ts`) · P.O. (S2-05) |
| nomes das categorias de cada nível | auto (`niveis.test.ts`) · P.O. (S2-05) |
| Começar abre o exercício da RF-05 | P.O. (S2-06) |
| Alto indisponível | P.O. (S2-05) |

## RF-05 · Abertura ou retomada

| Critério | Evidência |
|---|---|
| tentativa aberta é retomada, mesmo com exercício desativado (D-21) | auto (`tentativa.test.mjs`) |
| não resolvido de menor `ordem` | auto (`tentativa.test.mjs`) |
| todos resolvidos: o de menor `ordem`, com 0,5 | auto (`tentativa.test.mjs`); com a D-31, essa tentativa é treino (`treino.test.mjs`) |
| `numero_tentativa` = maior + 1 (RN-11) | auto (`tentativa.test.mjs`, `refazer.test.mjs`) |
| requisições simultâneas criam uma tentativa só | auto (`tentativa.test.mjs`, 10 conexões) |

## RF-06 · Apresentação

| Critério | Evidência |
|---|---|
| assinatura e descrição | P.O. (S3-01) |
| teste de exemplo com chamada, entrada e esperado | P.O. (S3-01) |
| código numerado | P.O. (S3-02) |
| nenhuma resposta traz os quatro campos secretos | auto (`tentativa.test.ts`, `auditoria.test.mjs`) · P.O. (aba Rede, S3-08) · prod (S6-02) |
| o exercício chega só por `POST /api/tentativa` (D-20) | auto (`montarResposta`) · P.O. (S3-08) |
| leitura direta de `codigo_com_defeito` negada | prod (`auditoria-producao.mjs`: `exercicios` → 401) |

## RF-07 · Localização

| Critério | Evidência |
|---|---|
| editor só leitura; Precheck, Verificar e Dica desabilitados; Desistir disponível | P.O. (S3, S5) |
| destaque da linha ao passar o cursor | demo |
| comparação no servidor, resposta só "correta ou não" | auto (`localizacao.test.mjs`) · P.O. (S3-08) |
| acerto na 1ª: fator 1,0 | auto (`estado.test.ts`, `pdr.test.ts`) · P.O. (S4: PDR 85) |
| erro e acerto: 0,6 | auto · demo |
| dois erros: libera com 0,3 | auto (`estado.test.ts`, `localizacao.test.mjs`) · demo |
| evento `localizou` com linha, acerto e número | auto (`localizacao.test.mjs`) |

## RF-08 · Edição

| Critério | Evidência |
|---|---|
| edição com realce de Python | P.O. (S3-05) |
| contador de linhas alteradas, diff linha a linha | auto (`linhas-alteradas.test.ts`) · P.O. |
| alerta acima de 3, sem bloquear nem pontuar | auto · demo |
| `editou` antes de Precheck, Verificar e Encerrar (RN-12) | auto (`edicao-precheck.test.mjs`, `encerramento.test.mjs`); `/api/verificar` e `/api/encerrar` gravam o código antes |

## RF-09 · Precheck

| Critério | Evidência |
|---|---|
| roda o teste de exemplo no navegador | auto (`nucleo-precheck.test.ts`, Pyodide real) · P.O. (S3-06) |
| falha mostra entrada, esperado e obtido | P.O. (S3-06) |
| não altera a pontuação | auto (`pdr.test.ts`: precheck não entra no cálculo) · P.O. |
| acima de 2 s: tempo excedido, uso consumido | código (`usePrecheck`: encerra o worker aos 2 s; o uso é gravado como `tempo_excedido`) · demo (`while True`) |
| ambiente carregando: "preparando", sem consumir uso | P.O. (S3-06) |
| 3 usos: botão desabilitado em 3/3 | P.O. (S3, captura de tela) |
| evento `precheck` com resultado e número do uso | auto (`edicao-precheck.test.mjs`) |

## RF-10 · Verificar

| Critério | Evidência |
|---|---|
| código enviado ao servidor e executado contra a suíte | auto (`verificacao.test.ts`, executor) · P.O. (S4) |
| tudo passou: `verificar` passou + `encerrou` resolvido, leva ao feedback | auto (`verificar.test.mjs`) · P.O. (S5) |
| falha: reparo −0,25, dicas 2 e 3 liberáveis | auto (`pdr.test.ts`, `dicas.test.mjs`) · P.O. (S4) |
| mais de 5 s ou exceção: sem sucesso (D-09) | auto (`executor`, `verificacao.test.ts`) · prod (S4-07: 5,3 s) |
| mostra passados do total, sem o conteúdo | P.O. (S4: "2 de 6 testes") |
| evento `verificar` com resultado, passados e total | auto (`verificar.test.mjs`) |

## RF-11 · Isolamento

| Critério | Evidência |
|---|---|
| sem credenciais no processo do aluno | prod (S4-07) |
| escrita só em área temporária | prod (S4-07) |
| memória sem limite não derruba | prod (S4-07: contido em 0,6 s) |
| laço infinito: `tempo_excedido` | prod (S4-07) |

## RF-12 · Dicas

| Critério | Evidência |
|---|---|
| editor travado: três indisponíveis, com motivo | auto (`dicas.test.ts`) · demo |
| destravado sem Verificar: 1 disponível, 2 e 3 travadas | auto (`dicas.test.ts`, `dicas.test.mjs`) |
| dica 1 devolve o texto, multiplicador 0,85 | auto · demo |
| dica 2 sem Verificar falho: recusa com a condição | auto (`dicas.test.mjs`: BH009) |
| dica 1 + Verificar falho: dica 2, 0,65 | auto · demo |
| dica 2 usada: dica 3, 0,40 | auto |
| leitura direta da tabela `dicas` negada | prod (`auditoria-producao.mjs`: 401) |
| evento `dica` com o nível | auto (`dicas.test.mjs`) |
| custo à vista antes de pedir | P.O. (prévia S4-06) · demo |

## RF-13 · Desistência

| Critério | Evidência |
|---|---|
| em qualquer estado, pede confirmação (D-17) | P.O. (S5) |
| confirmada: `editou` + `encerrou` desistiu, PDR 0 | auto (`encerramento.test.mjs`) · prod (conferência de PDR) |
| desistida não é retomada; oferece nova tentativa | auto (BH002) · P.O. (S5: redireciona ao resultado com "Tentar de novo") |
| localização não concluída: `calcularPdr` não falha, grava 0 | auto (`pdr.test.ts`, `encerramento.test.mjs`) |

## RF-14 · Pontuação

| Critério | Evidência |
|---|---|
| recalculada a cada ação | auto (`pdr.test.ts`: `pdrDoEstado`) · P.O. (S4) |
| base e efeito de localização, reparo e dica em linhas separadas | P.O. (S4-04) |
| `pdr_final` = `calcularPdr` | prod (conferência: 3 de 3 tentativas encerradas) |
| reexecutar dá exatamente o valor gravado | prod (idem) · auto (`pdr.test.ts`: pureza) |
| ,5 arredonda para cima (D-16) | auto (`pdr.test.ts`: dois casos reais de 42,5 → 43) |
| PDR acumulado = soma dos `pdr_final`, sem coluna de total | estrutura do banco (não há coluna); a v1 não exibe o acumulado (Requisitos §6) |

## RF-15 · Feedback

| Critério | Evidência |
|---|---|
| gerado e gravado no encerramento, qualquer desfecho | auto (`encerramento.test.mjs`, `feedback.test.ts`) · P.O. (S5) |
| explica o defeito, por que passa despercebido e a tentativa | P.O. (S5: "Exercício resolvido") |
| revisitar mostra o texto gravado, sem nova chamada | auto (`gravar_feedback` grava uma vez) · demo (recarregar) |
| falha ou 15 s: reserva, sem bloquear | auto (`modelo.test.ts`, `feedback.test.ts`) · demo (`FEEDBACK_MODEL` inválido no Preview) |
| gabarito pelo endpoint, ao lado do plantado e do submetido | P.O. (S5) |
| gabarito de tentativa aberta ou de outro aluno: recusa | auto (`encerramento.test.mjs`: BH011, BH001) · prod (401 sem login) |

## RF-16 · Repetir (com a D-31)

| Critério | Evidência |
|---|---|
| refazer cria tentativa com o número incrementado | auto (`refazer.test.mjs`) · P.O. (S5) |
| exercício não resolvido: repetição com 0,5 | auto (`pdr.test.ts`, `treino.test.mjs`) · prod (a tentativa de 36) |
| exercício já resolvido: treino, PDR 0 | auto (`treino.test.mjs`) · demo |
| o botão informa se vale metade ou é treino | P.O. (S5) |

## RF-17 · Eventos

| Critério | Evidência |
|---|---|
| toda ação grava evento com tipo, instante e payload | auto (testes do banco, um por tipo) |
| evento nunca alterado nem removido | auto (gatilho `eventos_imutaveis`, D-23) |
| cliente não insere, altera nem apaga | auto (`auditoria.test.mjs`) · prod (`auditoria-producao.mjs`: 401) |
| eventos reconstroem o estado inteiro | auto (`estado.test.ts`) · P.O. (S3: recarregar volta ao mesmo ponto) |

## Roteiro da demonstração (S6-06)

Numa conta nova, em produção:

1. Cadastrar com um e-mail já usado: aparece erro (RF-01).
2. Entrar com senha errada: a mensagem não diz se o e-mail existe (RF-02).
3. Fechar e reabrir o navegador: continua logado (RF-02).
4. Abrir um exercício: as três dicas aparecem indisponíveis, com o motivo; passar o cursor nas linhas destaca a linha (RF-07, RF-12).
5. Errar a linha e acertar na segunda: o painel mostra "Localização na 2ª" (RF-07).
6. Num outro exercício, errar a linha duas vezes: o editor destrava sozinho com 0,3 (RF-07).
7. Alterar mais de 3 linhas: o contador fica em alerta (RF-08).
8. Precheck com `while True: pass`: "Tempo excedido" depois de 2 s (RF-09).
9. Abrir a dica 1 (custo à vista), errar um Verificar, abrir a dica 2 (RF-12).
10. Resolver e, na tela final, recarregar: o mesmo texto do feedback (RF-15).
11. Em Temas, conferir "resolvidos / total" atualizado (RF-03).
12. "Tentar este de novo" no exercício resolvido: aparece "Treino", e o PDR final é 0 (RF-16).
13. Só no Preview, com `FEEDBACK_MODEL` inválido: desistir e ver o feedback de reserva (RF-15).

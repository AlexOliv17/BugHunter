# S3-08 · Auditoria de vazamento (RNF-03)

Data: 2026-09-29 · Branch `sprint-3-localizar-editar` (commit da S3-07) · Repetir na S6-02 sobre a versão publicada.

Campos auditados: `suite_oculta`, `codigo_correto`, `linha_defeito`, `categoria_codigo`.

## 1. Caminhos por onde algo chega ao navegador

| Caminho | O que devolve | Como foi conferido | Resultado |
|---|---|---|---|
| `POST /api/tentativa` | `tentativa {id, numero, multiplicador_repeticao}`, `estado` (reconstruído com campos escolhidos um a um), `exercicio {assinatura, descricao, codigo (com defeito), teste_exemplo, tema, nivel, base}` | leitura do código (lista explícita em `montarResposta`); teste unitário injeta os quatro campos na linha do banco e confere que não saem | limpo |
| `POST /api/localizar` | `{correta, tentativa, concluida}` | leitura do código | limpo: a linha certa só é "revelada" quando o aluno acerta, como a RN-01 prevê |
| `POST /api/editou` | `{linhas_alteradas}` | leitura do código | limpo |
| `POST /api/precheck` | `{numero_uso}` | leitura do código | limpo |
| Erros de todas as rotas | `{erro: <mensagem fixa>}`; nunca a mensagem do banco | leitura de `lib/api.ts` | limpo |
| Sem sessão | 401 nas quatro rotas | `curl` no build local | ok |
| Páginas `/temas` e `/temas/[tema]` (RSC) | colunas públicas de `temas_publicos`, `progresso_por_tema()`, `niveis_do_tema()` (nomes das categorias do nível, não a do exercício) | leitura do código | limpo |
| Página `/exercicio/[id]` | só o id da tentativa; o conteúdo vem por `/api/tentativa` (D-20) | leitura do código | limpo |
| Bundle do cliente (`.next/static`) | — | busca pelos quatro nomes e por marcas de chave (`sb_secret_`, `service_role`, chave Gemini) | nenhuma ocorrência |
| HTML público em produção (`/`, `/login`, `/cadastro`, `/temas`) | — | busca pelos mesmos termos | nenhuma ocorrência |
| Acesso direto ao Supabase com a chave pública | ver §2 | catálogo de privilégios | limpo |

## 2. Privilégios no banco (produção e teste local idênticos)

- `anon`: nenhuma tabela, nenhuma coluna, nenhuma função.
- `authenticated`: `SELECT` em `temas_publicos` e `usuarios` (RLS: só a própria linha), `UPDATE` só em `usuarios.nome`,
  `EXECUTE` só em `progresso_por_tema()` e `niveis_do_tema(text)`.
- Os quatro campos: ilegíveis para os dois papéis. `tentativas` e `eventos`: sem leitura nem escrita pelo cliente.

O teste `supabase/testes/auditoria.test.mjs` varre o catálogo inteiro. Uma tabela ou função nova que esqueça o
`revoke` faz o teste falhar.

## 3. O que só o P.O. pode conferir

O tráfego com sessão real, na aba Rede do navegador, num preview da branch: abrir um exercício, errar e acertar a
linha, editar, rodar três Prechecks, e procurar os quatro nomes e o código correto nas respostas.

## 4. Limitações conhecidas (vão para o README na S6-05)

- O aluno pode coletar vários programas com defeito abrindo tentativas; isso não expõe nenhum dos quatro campos.
- O Precheck roda no navegador: o aluno pode rodar o teste de exemplo quantas vezes quiser por fora. O limite de 3 vale
  para os usos registrados, que são os que contam.

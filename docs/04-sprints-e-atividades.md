# Plano de Sprints e Atividades (v1)

**PLANO DE SPRINTS · V1 — ESPECIFICAÇÃO DO PROJETO**

| | |
|---|---|
| **ALUNO / PRODUCT OWNER** | Alex Oliveira |
| **EXECUTOR** | agente de implementação |
| **VERSÃO** | 1.0 |
| **DOCUMENTOS RELACIONADOS** | Documentação do Projeto · Documento de Requisitos · Modelo de Entidades e Relacionamentos |

---

## 1. Como este plano funciona

### 1.1 Papéis

| PAPEL | QUEM | RESPONSABILIDADE |
|---|---|---|
| Product Owner | Alex | Decide regra de negócio, valida entregas, fornece credenciais, escreve os textos de conteúdo |
| Executor | o agente | Implementa as atividades na ordem, reporta ao fim de cada uma, para nos pontos de validação |

O P.O. não escreve código. O executor não decide regra de negócio.

### 1.2 Identificação das atividades

`S3-04` significa sprint 3, atividade 4. A ordem dentro da sprint é de dependência: S3-04 pressupõe S3-03 concluída.

### 1.3 Pontos de validação

Atividades marcadas com ◆ são pontos de parada obrigatória. O executor entrega, reporta e aguarda o aval do P.O. antes de seguir. As demais encadeiam sem interrupção.

Há dois tipos de ◆:

- **Validação** — o P.O. confere o que foi feito e aprova ou pede ajuste.
- **Insumo** — o P.O. precisa fornecer algo (credencial, texto, decisão) antes que a atividade possa começar.

### 1.4 Definição de pronto

Uma atividade só está pronta quando todas as condições valem:

1. O comportamento descrito funciona no ambiente de desenvolvimento.
2. Os critérios de aceitação dos requisitos citados foram verificados um a um.
3. Não há regressão nas atividades anteriores.
4. Nenhum segredo definido em RNF-03 chega ao cliente.
5. O código está no repositório, em commit com mensagem que cita o identificador da atividade.

### 1.5 Esforço

| SPRINT | TEMA | HORAS |
|---|---|---|
| S0 | Fundação e decisão de arquitetura | 10 |
| S1 | Banco de dados e catálogo de exercícios | 14 |
| S2 | Acesso e navegação | 10 |
| S3 | Exercício — localizar e editar | 15 |
| S4 | Verificar, pontuação e dicas | 14 |
| S5 | Encerramento e feedback | 11 |
| S6 | Endurecimento e entrega | 8 |
| | **Total** | **82** |

O plano da v1 estimava ~65 horas de funcionalidade. As 17 horas adicionais são verificação de segurança, bateria de aceitação e entrega — trabalho que não aparece na tela mas sem o qual a v1 não é entregável.

## 2. Sprint 0 · Fundação e decisão de arquitetura

**Objetivo:** ter o esqueleto no ar e a decisão sobre como executar código de aluno tomada com evidência. **Entregável:** aplicação vazia publicada, banco conectado, relatório do spike com recomendação.

| # | ATIVIDADE | REF. | H | ◆ |
|---|---|---|---|---|
| S0-01 | Criar repositório com `/app` (Next.js, TypeScript), `/pipeline` (Python) e `/docs` com os três documentos | — | 1 | |
| S0-02 | Receber credenciais do Supabase e da API do modelo; configurar variáveis de ambiente local e na Vercel | — | 1 | ◆ insumo |
| S0-03 | Publicar a aplicação vazia na Vercel e confirmar conexão com o Supabase | — | 1 | ◆ validação |
| S0-04 | Spike rota A: endpoint Python na Vercel executando subprocess com `env={}` e timeout | RN-03, RF-11 | 2 | |
| S0-05 | Spike rota B: route handler Node carregando Pyodide e executando código Python | RN-03, RF-11 | 2 | |
| S0-06 | Spike navegador: Web Worker com Pyodide rodando um teste e sendo encerrado por timeout | RN-02 | 2 | |
| S0-07 | Relatório do spike: para cada rota, funcionou ou não, tempo de partida a frio, tempo de resposta, e recomendação fundamentada | — | 1 | ◆ validação |

**Critério de saída da S0:** o P.O. escolheu a rota do Verificar. Se nenhuma funcionou, o plano C (Pyodide no cliente) é adotado e registrado como limitação conhecida.

## 3. Sprint 1 · Banco de dados e catálogo de exercícios

**Objetivo:** banco criado, protegido e populado com exercícios reais. **Entregável:** entre 15 e 25 exercícios no banco, gerados por um pipeline que roda duas vezes sem duplicar nada.

| # | ATIVIDADE | REF. | H | ◆ |
|---|---|---|---|---|
| S1-01 | Migration 001 — tabelas de catálogo: `temas`, `categorias_defeito`, `programas_base`, `exercicios`, `dicas` | E-02 a E-06 | 1 | |
| S1-02 | Migration 002 — tabelas operacionais: `usuarios`, `tentativas`, `eventos`, com constraints e índices | E-01, E-07, E-08 | 1 | |
| S1-03 | Migration 003 — views `temas_publicos` e `exercicios_publicos`, `revoke` / `grant`, políticas de RLS | RNF-03, RNF-04 | 1,5 | |
| S1-04 | Teste de segurança do banco: com uma sessão de aluno comum, tentar ler `dicas`, `exercicios`, `programas_base` e escrever em `tentativas` e `eventos`. Todas devem falhar | RNF-03, RNF-04 | 1 | ◆ validação |
| S1-05 | Seed de `temas` (4 linhas, só `fundamentos` ativa) e `categorias_defeito` (4 linhas) | E-02, E-03 | 0,5 | |
| S1-06 | Seed de `dicas` — os 12 textos, fornecidos pelo P.O. | E-06, RN-04 | 0,5 | ◆ insumo |
| S1-07 | Estrutura do `/pipeline`: carregador dos programas-base, executor de suíte, gravação no Supabase | RNF-08 | 2 | |
| S1-08 | Os 5 programas-base com `descricao`, `teste_exemplo` e `suite_oculta`, revisados pelo P.O. | E-04 | 2 | ◆ validação |
| S1-09 | Os 4 mutadores com o parâmetro `alvo`, alterando exatamente o n-ésimo nó elegível | Doc. Projeto §6.2 | 2 | |
| S1-10 | Validação dos 5 critérios e cálculo de `linha_defeito` contra a forma canônica | Doc. Projeto §6.3 | 1,5 | |
| S1-11 | Carga idempotente: uuid5 de chave natural, atribuição de `ordem`, segunda execução não duplica | RNF-08 | 1 | |
| S1-12 | Revisão do conteúdo gerado: o P.O. lê os exercícios um a um e confirma que cada `linha_defeito` está correta | — | 1 | ◆ validação |

**Critério de saída da S1:** o P.O. conferiu manualmente que a linha marcada como defeito é de fato a linha do defeito em todos os exercícios. Esta é a verificação mais importante do projeto inteiro — se ela falhar, o produto mede a coisa errada.

## 4. Sprint 2 · Acesso e navegação

**Objetivo:** o aluno entra, escolhe tema e nível, e chega a um exercício aberto. **Entregável:** fluxo navegável do login até a tela de exercício carregada.

| # | ATIVIDADE | REF. | H | ◆ |
|---|---|---|---|---|
| S2-01 | Cadastro com nome, e-mail e senha, sem confirmação por e-mail | RF-01 | 1,5 | |
| S2-02 | Login, sessão persistente e proteção das rotas autenticadas | RF-02 | 1,5 | |
| S2-03 | Criação da linha em `usuarios` espelhando `auth.users` no momento do cadastro | RF-01, E-01 | 1 | |
| S2-04 | Tela de temas com os quatro cards e o progresso no tema ativo | RF-03 | 2 | ◆ validação |
| S2-05 | Tela de nível com pontuação-base e categorias de cada nível | RF-04 | 1,5 | |
| S2-06 | Endpoint de abertura ou retomada de tentativa, implementando RN-09, RN-10 e RN-11 | RF-05 | 1,5 | |
| S2-07 | Testes de RN-09 (as três situações) e de RN-11 sob duas requisições simultâneas | RF-05 | 1 | |

**Critério de saída da S2:** o P.O. consegue criar conta, entrar, escolher Fundamentos e Médio, e chegar à tela de um exercício. Fechar e reabrir o navegador retoma a mesma tentativa.

## 5. Sprint 3 · Exercício — localizar e editar

**Objetivo:** a mecânica central funcionando: apontar a linha destrava o editor. **Entregável:** aluno localiza o defeito, edita o código e roda o Precheck no navegador.

| # | ATIVIDADE | REF. | H | ◆ |
|---|---|---|---|---|
| S3-01 | Layout da tela de exercício: enunciado, teste de exemplo, editor, painel lateral, barra de ações | RF-06 | 3 | |
| S3-02 | CodeMirror 6 com numeração de linha, realce Python e modo somente leitura | RF-06 | 2 | |
| S3-03 | Clique em linha e endpoint `/api/localizar`; a comparação acontece no servidor | RF-07, RN-01 | 2 | |
| S3-04 | Máquina de estados travado → liberado, com os três fatores de localização e o destravamento automático na segunda falha | RF-07, RN-01 | 1,5 | |
| S3-05 | Editor liberado com contador de linhas alteradas e alerta acima de 3 | RF-08, RN-08 | 1,5 | |
| S3-06 | Web Worker com Pyodide e o Precheck, com limite de 2 segundos e contador de 3 usos | RF-09, RN-02 | 3 | |
| S3-07 | Endpoints `/api/editou` e `/api/precheck` gravando os eventos correspondentes | RF-08, RF-09, RN-12 | 1 | |
| S3-08 | Auditoria de vazamento: inspecionar todo o tráfego e o HTML servido e confirmar ausência de `suite_oculta`, `codigo_correto`, `linha_defeito` e `categoria_codigo` | RNF-03 | 1 | ◆ validação |

**Critério de saída da S3:** o P.O. abre um exercício, erra a linha, acerta na segunda, edita o código, roda o Precheck três vezes e vê o botão desabilitar. A aba de rede do navegador não revela nenhum segredo.

## 6. Sprint 4 · Verificar, pontuação e dicas

**Objetivo:** o exercício se torna completável, com pontuação e ajuda graduada. **Entregável:** ciclo do exercício fechando com sucesso e pontuação correta.

| # | ATIVIDADE | REF. | H | ◆ |
|---|---|---|---|---|
| S4-01 | Endpoint de execução da suíte oculta, na rota decidida na S0, com limite de 5 segundos e ambiente sem credenciais | RF-10, RF-11 | 3 | |
| S4-02 | `/api/verificar`: executa, grava o evento `verificar`, e grava `encerrou` quando tudo passa | RF-10, RN-03 | 2 | |
| S4-03 | `calcularPdr(eventos, {base, numero_tentativa})` como função pura, com suíte de testes unitários cobrindo os cinco componentes e o exemplo trabalhado que resulta em 117 | RF-14, RN-05 | 2,5 | ◆ validação |
| S4-04 | Painel de pontuação ao vivo, discriminando o efeito de localização, reparo e dica | RF-14 | 2 | |
| S4-05 | `/api/dica` verificando a condição de liberação antes de responder | RF-12, RN-04 | 1,5 | |
| S4-06 | Interface das dicas nos três estados: indisponível com motivo, disponível com custo, usada com texto | RF-12 | 2 | |
| S4-07 | Teste de isolamento: submeter código que tenta ler variáveis de ambiente, escrever arquivo, consumir memória e entrar em laço infinito | RF-11, RNF-05 | 1 | ◆ validação |

**Critério de saída da S4:** o P.O. resolve um exercício do começo ao fim e confere que a pontuação final bate com a conta feita à mão. Código malicioso submetido não obtém nada e não derruba a aplicação.

## 7. Sprint 5 · Encerramento e feedback

**Objetivo:** fechar o ciclo pedagógico com a explicação personalizada. **Entregável:** o aluno termina o exercício e entende o que errou.

| # | ATIVIDADE | REF. | H | ◆ |
|---|---|---|---|---|
| S5-01 | `/api/encerrar`: grava `editou` e `encerrou`, calcula e grava `pdr_final` e `fechada_em` | RF-13, RF-14 | 1,5 | |
| S5-02 | Geração do feedback pelo modelo, com a entrada definida na Documentação do Projeto §7.2 | RF-15 | 2,5 | |
| S5-03 | Feedback de reserva e tratamento de falha, sem bloquear o encerramento | RF-15 | 1 | |
| S5-04 | `/api/gabarito/[tentativa_id]` com as duas condições: pertence ao solicitante e está encerrada | RF-15, RNF-03 | 1 | |
| S5-05 | Tela de feedback final com plantado, correto e submetido lado a lado | RF-15 | 2,5 | ◆ validação |
| S5-06 | Desistência com confirmação explícita e irreversibilidade | RF-13, RN-06 | 1 | |
| S5-07 | Refazer exercício com `numero_tentativa` incrementado e multiplicador 0,5 | RF-16, RN-07 | 1,5 | |

**Critério de saída da S5:** o P.O. desiste de um exercício, lê o feedback e considera que ele explica de fato onde o raciocínio falhou. Desligar a chave da API do modelo faz aparecer o feedback de reserva, sem erro na tela.

## 8. Sprint 6 · Endurecimento e entrega

**Objetivo:** a v1 pronta para o professor usar sem assistência. **Entregável:** aplicação publicada, estável, com todos os critérios de aceitação verificados.

| # | ATIVIDADE | REF. | H | ◆ |
|---|---|---|---|---|
| S6-01 | Rotina diária no GitHub Actions batendo no banco para evitar a pausa por inatividade | RNF-06 | 0,5 | |
| S6-02 | Revisão de segurança: repetir as auditorias de S1-04, S3-08 e S4-07 sobre a versão publicada | RNF-03, RNF-04, RNF-05 | 1,5 | ◆ validação |
| S6-03 | Bateria de aceitação: percorrer os critérios de RF-01 a RF-17 um a um, registrando o resultado de cada um | todos | 3 | ◆ validação |
| S6-04 | Medição e ajuste dos tempos de resposta contra as metas de RNF-02 | RNF-02 | 1 | |
| S6-05 | README com variáveis de ambiente, como rodar o pipeline, como publicar e limitações conhecidas | — | 1 | |
| S6-06 | Demonstração final ao P.O. sobre o ambiente publicado | — | 1 | ◆ validação |

**Critério de saída da S6:** o professor recebe o endereço, cria conta sozinho e resolve um exercício sem nenhuma intervenção.

## 9. Regras de engajamento do executor

### 9.1 Precedência dos documentos

Quando houver divergência entre documentos:

1. **Documento de Requisitos** define *o que* deve funcionar.
2. **Modelo de Entidades e Relacionamentos** define *como os dados existem*.
3. **Documentação do Projeto** define *por quê* e dá o contexto.

Divergência entre eles é defeito de especificação, não algo a resolver por conta própria. O executor reporta ao P.O. e aguarda.

### 9.2 Proibições

O executor não:

- inventa regra de negócio que não esteja nos documentos;
- altera escopo, nem para mais nem para menos;
- implementa item da lista "Fora de escopo" do Documento de Requisitos, seção 6;
- troca decisão arquitetural registrada (DA-01 a DA-07) sem aprovação;
- expõe ao cliente qualquer dos quatro segredos de RNF-03;
- permite que o cliente escreva em `tentativas` ou `eventos`;
- pula um ponto de validação ◆.

### 9.3 Formato do relatório de atividade

Ao concluir cada atividade, o executor reporta em no máximo dez linhas:

```
[S3-04] Máquina de estados do editor — concluída
O que foi feito: ...
Requisitos verificados: RF-07 (6 critérios), RN-01
Arquivos tocados: ...
Como validar: ...
Pendências ou dúvidas: nenhuma
```

Em atividade marcada com ◆, acrescenta: "Aguardando validação do P.O. para seguir."

### 9.4 Quando parar e perguntar

O executor interrompe e consulta o P.O. sempre que:

- os documentos não respondem uma pergunta necessária para continuar;
- dois documentos se contradizem;
- a implementação correta exigiria mudar uma decisão registrada;
- uma atividade se revela maior que o estimado em mais de 50%;
- um teste de segurança falha;
- surge a tentação de "melhorar" algo fora do escopo da atividade.

## 10. Insumos que o P.O. precisa fornecer

| QUANDO | INSUMO |
|---|---|
| Antes de S0-02 | Projeto Supabase criado; URL, chave anônima e chave de serviço |
| Antes de S0-02 | Chave da API do modelo de linguagem, e qual modelo usar |
| Antes de S0-03 | Conta Vercel com o repositório conectado |
| Antes de S1-06 | Os 12 textos de dica, três por categoria |
| Antes de S1-08 | Revisão dos 5 programas-base e suas suítes |
| Em S1-12 | Conferência manual de `linha_defeito` em todos os exercícios |

Os três primeiros itens bloqueiam o início. Os demais bloqueiam a sprint 1.

## 11. Riscos do plano

| RISCO | SINAL DE ALERTA | RESPOSTA |
|---|---|---|
| Nenhuma rota do Verificar funciona | S0-07 sem recomendação viável | adotar plano C e registrar como limitação |
| Pipeline gera menos de 12 exercícios | S1-12 com poucos itens | acrescentar programas-base, não relaxar critérios |
| `linha_defeito` errada em algum exercício | S1-12 | parar; o cálculo contra a forma canônica é obrigatório |
| Escopo crescendo durante a implementação | atividades fora da lista | o P.O. recusa; mudança de escopo exige revisar os documentos |
| Segredo vazando ao cliente | S1-04, S3-08 ou S6-02 falhando | bloqueia a entrega até ser corrigido |

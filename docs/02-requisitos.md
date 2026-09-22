# Documento de Requisitos (v1)

**DOCUMENTO DE REQUISITOS · V1 — ESPECIFICAÇÃO DO PROJETO**

| | |
|---|---|
| **ALUNO** | Alex Oliveira · Disciplina: Computação Aplicada à Educação |
| **VERSÃO** | 1.2 |
| **DOCUMENTOS RELACIONADOS** | Documentação do Projeto · Modelo de Entidades e Relacionamentos |

---

## 1. Convenções

| PREFIXO | SIGNIFICADO |
|---|---|
| RF-nn | Requisito funcional |
| RNF-nn | Requisito não funcional |
| RN-nn | Regra de negócio, definida na Documentação do Projeto, seção 5 |
| E-nn | Entidade, definida no Modelo de Entidades e Relacionamentos |

Prioridade segue MoSCoW: **Obrigatório** (sem ele não há v1) · **Importante** (v1 fica incompleta) · **Desejável** (corta primeiro se faltar tempo).

Critérios de aceitação usam **Dado / Quando / Então**. Cada critério é verificável objetivamente e serve como teste de aceitação.

Entidades referenciadas: E-01 `usuarios` · E-02 `temas` · E-03 `categorias_defeito` · E-04 `programas_base` · E-05 `exercicios` · E-06 `dicas` · E-07 `tentativas` · E-08 `eventos`.

## 2. Atores

| ATOR | DESCRIÇÃO | ESCOPO NA V1 |
|---|---|---|
| Aluno | Usuário autenticado que resolve exercícios | ator principal |
| Sistema | A aplicação, o endpoint de execução e a chamada ao modelo | — |
| Autor do conteúdo | Escreve programas-base, suítes e dicas; roda o pipeline | atua fora da aplicação |

Não há ator "professor" com visão privilegiada na v1. O professor usa o sistema como aluno.

## 3. Requisitos funcionais

### Autenticação e acesso

#### RF-01 · Cadastro de aluno
*Prioridade: Obrigatório · Entidades: E-01*

O sistema deve permitir que um visitante crie conta informando nome, e-mail e senha.

- **Dado** um visitante na tela de cadastro, **quando** informar nome, e-mail válido e senha de ao menos 8 caracteres, **então** a conta é criada e ele entra autenticado.
- **Dado** um e-mail já cadastrado, **quando** tentar criar conta com ele, **então** o sistema exibe erro e não cria conta duplicada.
- **Dado** um cadastro concluído, **quando** a conta é criada, **então** o acesso é imediato, sem confirmação por e-mail (D-07).
- **Dado** a conta criada no Supabase Auth, **quando** o cadastro terminar, **então** existe linha correspondente em `usuarios` com o mesmo `id`.

#### RF-02 · Autenticação
*Prioridade: Obrigatório · Entidades: E-01*

O sistema deve autenticar por e-mail e senha e manter a sessão entre visitas.

- **Dado** um aluno cadastrado, **quando** informar credenciais corretas, **então** é redirecionado à tela de temas.
- **Dado** credenciais incorretas, **quando** submeter, **então** o sistema exibe erro genérico, sem revelar se o e-mail existe.
- **Dado** um aluno autenticado, **quando** fechar e reabrir o navegador dentro da validade da sessão, **então** continua autenticado.
- **Dado** um visitante não autenticado, **quando** acessar qualquer rota de exercício, **então** é redirecionado ao login.

### Navegação e seleção

#### RF-03 · Listagem de temas
*Prioridade: Obrigatório · Entidades: E-02, E-04, E-05, E-07*

O sistema deve exibir os temas, indicando os ativos e os que virão em versões futuras, com o progresso do aluno no tema ativo.

- **Dado** um aluno autenticado, **quando** acessar a tela de temas, **então** vê todas as linhas de `temas`, ordenadas.
- **Dado** um tema com `ativo = false`, **quando** for exibido, **então** aparece com marcação de indisponível e não é clicável.
- **Dado** o tema ativo, **quando** for exibido, **então** mostra exercícios resolvidos sobre o total do tema, contados conforme a consulta de progresso do Modelo de Dados, seção 6.

#### RF-04 · Seleção de nível
*Prioridade: Obrigatório · Entidades: E-03, E-05*

O sistema deve permitir escolher entre Baixo e Médio, informando a pontuação-base e as categorias de cada nível.

- **Dado** o tema ativo selecionado, **quando** a tela carregar, **então** exibe Baixo (100 pontos) e Médio (200 pontos).
- **Dado** um nível exibido, **quando** for renderizado, **então** lista os nomes das categorias daquele nível.
- **Dado** um nível escolhido, **quando** o aluno confirmar, **então** o sistema abre o exercício definido por RF-05.
- **Dado** o nível Alto, **quando** for exibido, **então** aparece como indisponível.

#### RF-05 · Abertura ou retomada da tentativa
*Prioridade: Obrigatório · Regras: RN-09, RN-10, RN-11 · Entidades: E-05, E-07*

Ao entrar num nível, o sistema deve escolher o exercício e abrir ou retomar a tentativa correspondente.

- **Dado** uma tentativa com desfecho `aberto` naquele tema e nível, **quando** o aluno iniciar, **então** ela é retomada, sem criar nova (RN-10), mesmo que o exercício dela tenha sido desativado (D-21).
- **Dado** nenhuma tentativa aberta e exercícios não resolvidos, **quando** o aluno iniciar, **então** recebe o não resolvido de menor `ordem`.
- **Dado** nenhuma tentativa aberta e todos os exercícios resolvidos, **quando** o aluno iniciar, **então** recebe o de menor `ordem`, com `multiplicador_repeticao` igual a 0,5.
- **Dado** a criação de uma tentativa, **quando** ocorrer, **então** `numero_tentativa` recebe o maior valor existente para aquele par aluno-exercício, mais um (RN-11).
- **Dado** duas requisições simultâneas de abertura para o mesmo exercício, **quando** forem processadas, **então** apenas uma tentativa é criada, garantida pela restrição de unicidade do banco.

### Exercício — localização

#### RF-06 · Apresentação do exercício
*Prioridade: Obrigatório · Entidades: E-04, E-05*

O sistema deve exibir enunciado, teste de exemplo e código com defeito.

- **Dado** um exercício aberto, **quando** a tela carregar, **então** exibe a assinatura da função e a descrição, ambas de `programas_base`.
- **Dado** um exercício aberto, **quando** a tela carregar, **então** exibe o teste de exemplo com chamada, entrada e resultado esperado.
- **Dado** um exercício aberto, **quando** a tela carregar, **então** exibe `codigo_com_defeito` numerado por linha.
- **Dado** qualquer resposta enviada ao navegador durante a tentativa, **quando** for inspecionada, **então** não contém `suite_oculta`, `codigo_correto`, `linha_defeito` nem `categoria_codigo`.
- **Dado** um exercício aberto, **quando** a tela carregar, **então** o código, o enunciado e o teste de exemplo chegam exclusivamente pela resposta de `POST /api/tentativa`, que devolve apenas o exercício da tentativa aberta daquele aluno (D-20).
- **Dado** o cliente consultando o banco diretamente, **quando** tentar ler `codigo_com_defeito` de qualquer exercício, **então** a leitura é negada: não existe view nem grant que exponha o código dos exercícios (D-20).

#### RF-07 · Localização do defeito
*Prioridade: Obrigatório · Regras: RN-01 · Entidades: E-05, E-07, E-08*

O sistema deve bloquear a edição até que o aluno aponte a linha, com no máximo duas tentativas.

- **Dado** um exercício recém-aberto, **quando** a tela carregar, **então** o editor está em somente leitura e os botões Precheck, Verificar e Dica estão desabilitados; Desistir permanece disponível (D-17).
- **Dado** o editor bloqueado, **quando** o cursor passar sobre uma linha, **então** a linha recebe destaque indicando que é clicável.
- **Dado** o editor bloqueado, **quando** o aluno clicar numa linha, **então** a comparação com `linha_defeito` é feita no servidor e a resposta informa apenas se estava correta.
- **Dado** um acerto na 1ª tentativa, **quando** for registrado, **então** o editor é liberado e o fator de localização é 1,0.
- **Dado** erro na 1ª e acerto na 2ª, **quando** for registrado, **então** o editor é liberado e o fator é 0,6.
- **Dado** erro nas duas tentativas, **quando** a segunda for registrada, **então** o editor é liberado automaticamente e o fator é 0,3.
- **Dado** qualquer clique de localização, **quando** for processado, **então** um evento `localizou` é gravado com linha, acerto e número da tentativa.

### Exercício — edição e verificação

#### RF-08 · Edição do código
*Prioridade: Obrigatório · Regras: RN-08, RN-12 · Entidades: E-08*

O sistema deve permitir editar o código após a liberação, contando as linhas alteradas.

- **Dado** o editor liberado, **quando** o aluno digitar, **então** a alteração é aceita com realce de sintaxe Python.
- **Dado** o aluno editando, **quando** a contagem de linhas alteradas mudar, **então** o contador exibido é atualizado. A contagem compara o editor com `codigo_com_defeito`, linha a linha: cada linha modificada, inserida ou removida conta 1.
- **Dado** mais de 3 linhas alteradas, **quando** o limite for ultrapassado, **então** o contador recebe destaque de alerta, sem bloquear a edição nem alterar a pontuação.
- **Dado** o aluno acionando Precheck, Verificar ou Encerrar, **quando** a ação for processada, **então** um evento `editou` é gravado antes dela, com o código atual e o número de linhas alteradas (RN-12).

#### RF-09 · Precheck
*Prioridade: Obrigatório · Regras: RN-02 · Entidades: E-04, E-08*

O sistema deve executar o teste de exemplo no navegador, sem custo de pontuação e com limite de três usos.

- **Dado** o editor liberado e menos de 3 prechecks usados, **quando** o aluno acionar Precheck, **então** o código roda contra o teste de exemplo no navegador e o resultado é exibido.
- **Dado** um precheck que falha, **quando** o resultado for exibido, **então** mostra entrada, valor esperado e valor obtido.
- **Dado** um precheck concluído, **quando** o resultado voltar, **então** a pontuação exibida não se altera.
- **Dado** um código cuja execução ultrapassa 2 segundos, contados a partir do despacho a um worker já inicializado, **quando** o limite for atingido, **então** o worker é encerrado, o sistema informa tempo excedido e o uso é contabilizado (D-10).
- **Dado** o Pyodide ainda em carga, **quando** o aluno acionar Precheck, **então** o sistema mostra "preparando o ambiente" e o uso não é consumido.
- **Dado** 3 usos consumidos, **quando** a tela for renderizada, **então** o botão aparece desabilitado com o contador em 3/3.
- **Dado** qualquer precheck, **quando** for concluído, **então** um evento `precheck` é gravado com `resultado` entre `passou`, `falhou`, `tempo_excedido` e `erro`, e o número do uso.

#### RF-10 · Verificar
*Prioridade: Obrigatório · Regras: RN-03 · Entidades: E-04, E-05, E-08*

O sistema deve executar a suíte oculta no servidor e atualizar a pontuação conforme o resultado.

- **Dado** o editor liberado, **quando** o aluno acionar Verificar, **então** o código é enviado ao servidor e executado contra `suite_oculta`.
- **Dado** todos os testes passando, **quando** o resultado voltar, **então** um evento `verificar` com `resultado = 'passou'` e um evento `encerrou` com `desfecho = 'resolvido'` são gravados, e o aluno é levado ao feedback final.
- **Dado** ao menos um teste falhando, **quando** o resultado voltar, **então** o fator de reparo é reduzido em 0,25 e as dicas 2 e 3 passam a ser liberáveis.
- **Dado** um Verificar que excede 5 segundos ou lança exceção, **quando** ocorrer, **então** é tratado como sem sucesso: aplica −0,25 e libera as dicas (D-09).
- **Dado** um Verificar sem sucesso, **quando** o resultado for exibido, **então** informa quantos testes passaram do total, sem exibir o conteúdo dos testes.
- **Dado** qualquer Verificar, **quando** for concluído, **então** um evento `verificar` é gravado com `resultado`, `passados` e `total`.

#### RF-11 · Isolamento na execução do código
*Prioridade: Obrigatório · Regras: RN-03 · RNF: RNF-05*

O sistema deve executar o código do aluno de forma isolada, sem acesso a segredos.

- **Dado** código de aluno que tente ler variáveis de ambiente, **quando** for executado, **então** não obtém a chave de serviço nem qualquer credencial.
- **Dado** código de aluno que tente escrever no sistema de arquivos, **quando** for executado, **então** a escrita não atinge nada fora de área temporária descartável.
- **Dado** código que consuma memória sem limite, **quando** for executado, **então** o processo é encerrado sem derrubar a aplicação.
- **Dado** código que entre em laço infinito, **quando** ultrapassar o limite, **então** é interrompido e devolve `tempo_excedido`.

### Exercício — dicas

#### RF-12 · Dicas graduadas
*Prioridade: Obrigatório · Regras: RN-04 · Entidades: E-03, E-06, E-08*

O sistema deve oferecer três níveis de dica, com liberação condicionada e custo em pontuação.

- **Dado** o editor ainda travado, **quando** a tela for renderizada, **então** as três dicas aparecem indisponíveis, com o motivo visível (D-08).
- **Dado** o editor destravado e nenhum Verificar realizado, **quando** a tela for renderizada, **então** a dica 1 aparece disponível e as dicas 2 e 3 travadas, com o motivo visível.
- **Dado** a dica 1 disponível, **quando** o aluno solicitá-la, **então** o servidor devolve o texto correspondente à categoria e o multiplicador passa a 0,85.
- **Dado** nenhum Verificar sem sucesso, **quando** o aluno tentar pedir a dica 2, **então** o servidor recusa e informa a condição de liberação.
- **Dado** a dica 1 usada e ao menos um Verificar sem sucesso, **quando** o aluno pedir a dica 2, **então** o texto é devolvido e o multiplicador passa a 0,65.
- **Dado** a dica 2 usada, **quando** o aluno pedir a dica 3, **então** o texto é devolvido e o multiplicador passa a 0,40.
- **Dado** o cliente consultando o banco diretamente, **quando** tentar ler a tabela de dicas, **então** a leitura é negada.
- **Dado** qualquer dica devolvida, **quando** for exibida, **então** um evento `dica` é gravado com o nível.
- **Dado** o custo de uma dica, **quando** o botão for exibido, **então** o custo aparece antes de o aluno decidir.

### Exercício — encerramento

#### RF-13 · Desistência
*Prioridade: Obrigatório · Regras: RN-06 · Entidades: E-07, E-08*

O sistema deve permitir encerrar a tentativa sem resolver, zerando a pontuação.

- **Dado** uma tentativa aberta, em qualquer estado — inclusive com o editor travado —, **quando** o aluno acionar Desistir, **então** o sistema pede confirmação explícita (D-17).
- **Dado** a confirmação, **quando** for aceita, **então** um evento `editou` e um evento `encerrou` com `desfecho = 'desistiu'` são gravados, e a tentativa fecha com `pdr_final = 0`.
- **Dado** uma tentativa encerrada por desistência, **quando** o aluno tentar retomá-la, **então** o sistema recusa e oferece iniciar nova tentativa.
- **Dado** uma desistência com a localização não concluída — nenhum evento `localizou`, ou um único incorreto —, **quando** o PDR for calculado, **então** `calcularPdr` não falha, usa fator de localização 0,3 e o resultado gravado é `pdr_final = 0` (D-17).

#### RF-14 · Cálculo e exibição da pontuação
*Prioridade: Obrigatório · Regras: RN-05 · Entidades: E-03, E-05, E-07, E-08*

O sistema deve calcular o PDR a partir dos eventos e exibi-lo em tempo real.

- **Dado** uma tentativa em andamento, **quando** qualquer ação pontuável ocorrer, **então** o valor exibido é recalculado e atualizado na tela.
- **Dado** o painel de pontuação, **quando** for exibido, **então** mostra a base e, em linhas separadas, o efeito percentual de cada componente: localização, reparo e dica.
- **Dado** uma tentativa encerrada, **quando** o encerramento for gravado, **então** `pdr_final` recebe o resultado de `calcularPdr(eventos, {base, numero_tentativa})`.
- **Dado** os eventos de uma tentativa encerrada, **quando** `calcularPdr` for reexecutada com os mesmos argumentos, **então** produz exatamente o valor gravado.
- **Dado** um cálculo cujo valor tem parte fracionária exatamente 0,5, **quando** for arredondado, **então** arredonda para cima: 42,5 → 43 (D-16).
- **Dado** o PDR acumulado, **quando** for consultado, **então** resulta da soma dos `pdr_final`, sem coluna de total acumulado.

#### RF-15 · Feedback final gerado por IA
*Prioridade: Obrigatório · Entidades: E-04, E-05, E-07, E-08*

Ao encerrar uma tentativa, o sistema deve gerar um texto explicativo personalizado.

- **Dado** uma tentativa encerrada por qualquer desfecho, **quando** o encerramento ocorrer, **então** o sistema gera o feedback e o grava em `feedback_texto`.
- **Dado** o feedback gerado, **quando** for exibido, **então** contém qual era o defeito, por que passa despercebido, e análise da tentativa do aluno.
- **Dado** um feedback já gravado, **quando** o aluno revisitar a tela, **então** o texto armazenado é reexibido, sem nova chamada ao modelo.
- **Dado** falha ou estouro de 15 segundos na chamada, **quando** ocorrer, **então** o sistema grava um feedback de reserva com os dados estruturados e não bloqueia o encerramento.
- **Dado** uma tentativa encerrada, **quando** a tela de feedback carregar, **então** obtém `codigo_correto` e `linha_defeito` pelo endpoint de gabarito e os exibe ao lado do código plantado e do submetido.
- **Dado** uma tentativa ainda aberta ou de outro aluno, **quando** o endpoint de gabarito for chamado para ela, **então** a requisição é recusada.

#### RF-16 · Repetir exercício
*Prioridade: Importante · Regras: RN-07, RN-11 · Entidades: E-07*

O sistema deve permitir nova tentativa de um exercício encerrado, com pontuação reduzida.

- **Dado** uma tentativa encerrada, **quando** o aluno acionar refazer, **então** uma nova tentativa é criada com `numero_tentativa` incrementado.
- **Dado** uma tentativa com `numero_tentativa` maior que 1, **quando** o PDR for calculado, **então** aplica `multiplicador_repeticao` igual a 0,5.
- **Dado** o botão de refazer, **quando** for exibido, **então** informa que a repetição vale metade.

### Registro

#### RF-17 · Registro de eventos
*Prioridade: Obrigatório · Entidades: E-08*

Toda ação relevante deve gerar um registro imutável, gravado pelo servidor.

- **Dado** qualquer ação de localizar, editar, precheck, verificar, pedir dica ou encerrar, **quando** ocorrer, **então** um evento é gravado com tipo, instante e payload conforme o Modelo de Dados.
- **Dado** um evento gravado, **quando** qualquer operação posterior ocorrer, **então** o evento não é alterado nem removido.
- **Dado** o cliente tentando inserir, alterar ou apagar um evento diretamente no banco, **quando** a operação for submetida, **então** é negada.
- **Dado** os eventos de uma tentativa lidos em ordem, **quando** forem processados, **então** permitem reconstruir integralmente o estado: localização feita e seu fator, edições, usos de precheck, verificações, dicas usadas e desfecho.

## 4. Requisitos não funcionais

**RNF-01 · Custo de operação — Obrigatório.** A plataforma deve operar em planos gratuitos, sem custo recorrente de infraestrutura. Admite-se custo variável de chamadas ao modelo, limitado ao feedback final, gerado uma única vez por tentativa.

**RNF-02 · Tempo de resposta — Importante.**

| OPERAÇÃO | ALVO | TETO |
|---|---|---|
| carregar a tela de exercício | 1,5 s | 3 s |
| Precheck | 1 s | 2 s (limite rígido) |
| Verificar | 2 s | 5 s (limite rígido) |
| gerar o feedback final | 5 s | 15 s, com reserva após isso |

**RNF-03 · Segredo do exercício — Obrigatório.** Quatro informações não podem chegar ao cliente antes do encerramento da tentativa: `suite_oculta`, `codigo_correto`, `linha_defeito` e `categoria_codigo`. Não trafegam em respostas de API, não aparecem no HTML servido, não são embutidas em código do cliente. Os textos de `dicas` só trafegam pelo endpoint, após a condição de liberação ser satisfeita.

**RNF-04 · Isolamento de dados entre alunos — Obrigatório.** Um aluno não pode ler nem alterar tentativas e eventos de outro. A restrição é aplicada por ausência de grant e por Row Level Security no banco, não apenas na aplicação.

**RNF-05 · Isolamento na execução de código — Obrigatório.** A execução de código do aluno não pode acessar credenciais, escrever fora de área temporária descartável, nem comprometer a disponibilidade. Ver RF-11.

**RNF-06 · Disponibilidade — Importante.** O sistema deve estar acessível sempre que o professor abrir o endereço, sem ação manual prévia. Como o plano gratuito do banco pausa projetos após cerca de sete dias de inatividade, deve existir rotina automática diária que mantenha o projeto ativo.

**RNF-07 · Navegadores suportados — Importante.** Versões atuais de Chrome, Firefox e Safari em desktop. O layout é de 1440 px e não precisa ser utilizável em telas de celular na v1.

**RNF-08 · Reprodutibilidade do banco de exercícios — Importante.** O pipeline deve ser idempotente: executado duas vezes sobre os mesmos programas-base e mutadores, produz os mesmos exercícios, com os mesmos identificadores, obtidos por uuid5 de chave natural. A versão do mutador é registrada em cada exercício. Uma segunda execução atualiza as linhas existentes em vez de duplicá-las.

**RNF-09 · Rastreabilidade da pontuação — Obrigatório.** Deve ser possível reconstruir qualquer pontuação a partir dos eventos, da base e do número da tentativa. Alterar os pesos da fórmula e recalcular o histórico completo não pode exigir migração destrutiva.

**RNF-10 · Idioma — Obrigatório.** Interface, enunciados, dicas e feedback em português do Brasil.

## 5. Matriz de rastreabilidade

| RF | TELAS | REGRAS | ENTIDADES |
|---|---|---|---|
| RF-01 | 1 Login | — | E-01 |
| RF-02 | 1 Login | — | E-01 |
| RF-03 | 2 Temas | — | E-02, E-04, E-05, E-07 |
| RF-04 | 3 Nível | — | E-03, E-05 |
| RF-05 | 3 Nível → 4 Exercício | RN-09, RN-10, RN-11 | E-05, E-07 |
| RF-06 | 4 Exercício travado | — | E-04, E-05 |
| RF-07 | 4 Exercício travado | RN-01 | E-05, E-07, E-08 |
| RF-08 | 5 Exercício liberado | RN-08, RN-12 | E-08 |
| RF-09 | 5 liberado, 6 precheck | RN-02 | E-04, E-08 |
| RF-10 | 5 Exercício liberado | RN-03 | E-04, E-05, E-08 |
| RF-11 | — | RN-03 | — |
| RF-12 | 4 travado, 5 liberado | RN-04 | E-03, E-06, E-08 |
| RF-13 | 4 travado, 5 liberado | RN-06 | E-07, E-08 |
| RF-14 | 4, 5, 6, 7 | RN-05 | E-03, E-05, E-07, E-08 |
| RF-15 | 7 Feedback | — | E-04, E-05, E-07, E-08 |
| RF-16 | 7 Feedback | RN-07, RN-11 | E-07 |
| RF-17 | todas | RN-12 | E-08 |

Telas: 1 Login · 2 Temas · 3 Nível · 4 Exercício travado · 5 Exercício liberado · 6 Resultado do precheck · 7 Feedback final. As telas 4, 5 e 6 são a mesma rota em estados diferentes.

## 6. Fora de escopo na v1

Registrado para evitar ambiguidade. Nenhum item abaixo deve ser construído, ainda que as telas o antecipem.

| ITEM | OBSERVAÇÃO |
|---|---|
| Elo e janela móvel | telas desenhadas; depende só do PDR, que já existirá |
| Ranking semanal e geral | idem |
| Perfil com domínio por categoria | idem; consulta já escrita no Modelo de Dados |
| Sequência de dias consecutivos | não desenhado |
| Nível Alto e as 5 categorias restantes | pipeline suporta, faltam os mutadores |
| Temas de POO e Estrutura de Dados | `temas` já existe; faltam os programas-base |
| Dicas geradas sob medida | dicas da v1 são textos fixos por categoria |
| Visão de professor ou turma | não há ator privilegiado na v1 |
| Recuperação de senha | cadastro e login apenas |
| Uso em celular | layout de desktop |
| Penalidade por reescrita excessiva | contador é informativo (D-02) |

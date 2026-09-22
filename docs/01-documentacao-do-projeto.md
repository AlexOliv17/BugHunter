# Documentação do Projeto (v1)

**DOCUMENTAÇÃO TÉCNICA · V1 — ESPECIFICAÇÃO DO PROJETO**

| | |
|---|---|
| **ALUNO** | Alex Oliveira |
| **DISCIPLINA** | Computação Aplicada à Educação |
| **ÁREAS DE PESQUISA** | Inteligência Artificial na Educação · Gamificação e Jogos Digitais na Educação |
| **VERSÃO DO DOCUMENTO** | 1.2 |
| **DOCUMENTOS RELACIONADOS** | Documento de Requisitos · Modelo de Entidades e Relacionamentos |

---

## 1. Contexto e motivação

### 1.1 O problema educacional

Cursos de computação dedicam a maior parte do esforço a ensinar o aluno a escrever código. Ler o código de outra pessoa, entender o que ele faz e descobrir onde ele está errado é uma habilidade tão central quanto — e é treinada quase sempre por acidente, quando o aluno esbarra num defeito no próprio trabalho.

O resultado é previsível: alunos que produzem código razoável travam ao receber um programa alheio com defeito. Falta-lhes um método de busca. Leem o código do começo ao fim esperando que o erro salte aos olhos, em vez de formular hipóteses sobre a natureza do defeito e testá-las.

### 1.2 O objetivo pedagógico

O BugHunter treina depuração e leitura de código de forma deliberada, separando explicitamente as duas operações que compõem essa habilidade:

1. **Diagnosticar** — localizar onde está o defeito.
2. **Reparar** — corrigi-lo.

A separação é o mecanismo central do sistema. Ao exigir que o aluno aponte a linha antes de poder editar, o BugHunter impede a estratégia de reescrever a função do zero, que conclui o exercício sem exercitar o diagnóstico.

### 1.3 Público-alvo

Estudantes de graduação em computação cursando disciplinas introdutórias de programação, ou já aprovados nelas e em processo de consolidação. A v1 cobre conteúdo de Fundamentos de Programação: variáveis, condicionais, laços, listas e funções.

## 2. Visão geral do produto

### 2.1 Em uma página

O aluno entra na plataforma, escolhe um tema e um nível de dificuldade, e recebe um exercício: uma função Python que já funcionou e foi quebrada de propósito, com um enunciado descrevendo o que ela deveria fazer e um teste de exemplo mostrando uma entrada e a saída esperada.

O editor de código começa travado. O aluno precisa primeiro clicar na linha onde acha que está o defeito, e tem duas tentativas: acertando na primeira mantém a pontuação cheia, acertando na segunda perde parte dela, e errando as duas o editor destrava mesmo assim com a menor pontuação de localização.

Com o editor liberado, ele corrige o código. Tem dois botões para testar:

- **Precheck** roda apenas o teste de exemplo, aquele visível na tela. Não custa pontos, limitado a três usos.
- **Verificar** roda a suíte completa de testes, que ele nunca viu, incluindo casos de borda. Cada falha reduz a pontuação.

Se travar, pode pedir até três dicas, cada uma revelando mais e custando mais pontos. Se desistir, recebe um feedback explicando qual era o defeito, por que ele passa despercebido e onde o raciocínio dele falhou.

### 2.2 Fluxo completo do usuário

```
   Login
     │
     ▼
   Escolha do tema ──► Fundamentos de Programação (único ativo na v1)
     │
     ▼
   Escolha do nível ──► Baixo (100 pts) ou Médio (200 pts)
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ EXERCÍCIO                                               │
│                                                         │
│ estado 1: editor travado                                │
│ └─ aluno clica numa linha ──┬─ acertou → fator 1,0      │
│                             ├─ errou 1x → 2ª chance     │
│                             └─ errou 2x → fator 0,3     │
│                                (destrava igual)         │
│ estado 2: editor liberado                               │
│ ├─ edita o código                                       │
│ ├─ Precheck (até 3x, grátis, só teste de exemplo)       │
│ ├─ Dica 1 (multiplicador 0,85)                          │
│ ├─ Verificar (suíte oculta)                             │
│ │    ├─ passou → exercício resolvido                    │
│ │    └─ falhou → fator de reparo −0,25                  │
│ │               e libera as dicas 2 e 3                 │
│ └─ Desistir → PDR = 0                                   │
│                                                         │
│ Desistir está disponível nos dois estados (D-17).       │
└─────────────────────────────────────────────────────────┘
     │
     ▼
   Feedback final (gerado por IA a partir do histórico da tentativa)
     │
     ▼
   Próximo exercício ou Refazer este (base × 0,5)
```

## 3. Escopo da v1

### 3.1 Dentro e fora

| DIMENSÃO | V1 | FORA DA V1 |
|---|---|---|
| Temas | Fundamentos de Programação | POO, Estrutura de Dados I e II |
| Níveis | Baixo, Médio | Alto |
| Categorias de defeito | 4 | outras 5 |
| Programas-base | 5 | ampliação do catálogo |
| Exercícios gerados | 15 a 25 | — |
| Dicas | 12 textos fixos, escritos à mão | dicas geradas sob medida |
| Uso de IA | feedback final apenas | — |
| Pontuação | PDR por exercício e acumulado | elo, janela móvel, rankings |
| Perfil e ranking | fora | telas já desenhadas, entram depois |
| Experimentos de pesquisa | fora | — |

### 3.2 Catálogo de categorias de defeito

Cada categoria pertence a exatamente um nível de dificuldade, e o nível define a pontuação-base do exercício.

| CÓDIGO | NOME | NÍVEL | MUTAÇÃO APLICADA |
|---|---|---|---|
| `CMP_INV` | comparador invertido | baixo | `<` ↔ `<=` , `>` ↔ `>=` |
| `ARIT_TROC` | operador aritmético trocado | baixo | `+`↔`-`, `*`↔`/`, também em `+=`, `-=`, `*=`, `/=` (D-19) |
| `LACO_DESL` | limite de laço deslocado | médio | subtrai 1 do `stop`: `range(n)` → `range(n-1)`, `range(a, b)` → `range(a, b-1)`; o passo nunca é tocado (D-18) |
| `ACUM_AUSENTE` | acumulador não atualizado | médio | remove a atribuição que atualiza o acumulador |

### 3.3 Catálogo de programas-base

Funções curtas, de 6 a 10 linhas, cada uma acompanhada de um teste de exemplo público e de uma suíte oculta com casos de borda.

| FUNÇÃO | O QUE FAZ | CATEGORIAS APLICÁVEIS |
|---|---|---|
| `media_das_notas(notas)` | média aritmética de uma lista | todas as 4 |
| `maior_valor(lista)` | maior elemento de uma lista | `CMP_INV` , `LACO_DESL` |
| `conta_aprovados(notas, corte)` | conta quantos passam de um corte | `CMP_INV` , `ARIT_TROC` , `ACUM_AUSENTE` |
| `inverte_lista(lista)` | devolve a lista invertida | `LACO_DESL` |
| `soma_pares(numeros)` | soma apenas os números pares | `ARIT_TROC` , `LACO_DESL` , `ACUM_AUSENTE` |

São 13 combinações de programa e categoria. Como um mesmo programa pode ter mais de um ponto onde a mesma mutação se aplica — duas comparações, dois operadores aritméticos — e o pipeline gera um exercício por ocorrência (seção 6.2), o número de candidatos fica acima de 13. Descontando as mutações inócuas, a expectativa é de 15 a 25 exercícios válidos. Se ficar abaixo disso, a correção é acrescentar programas-base, que é barato.

## 4. Arquitetura

### 4.1 Visão de componentes

```
┌──────────────────────────────────────────────────────────────┐
│ NAVEGADOR DO ALUNO                                           │
│                                                              │
│ CodeMirror 6   clique na linha, edição, contagem de diff     │
│ Pyodide        Web Worker — roda o teste de exemplo          │
│                timeout por worker.terminate()                │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼──────────────────────────────────┐
│ VERCEL · Next.js (App Router, TypeScript)                    │
│                                                              │
│ GET /login · /temas · /temas/[tema] · /exercicio/[id]        │
│                                                              │
│ POST /api/tentativa      inicia ou retoma; devolve o exercício│
│ POST /api/localizar      registra a linha apontada           │
│ POST /api/editou         registra o código submetido         │
│ POST /api/precheck       registra o resultado do cliente     │
│ POST /api/verificar   ──┐ executa a suíte oculta             │
│ POST /api/dica          │ devolve o texto da dica            │
│ POST /api/encerrar      │ fecha e gera o feedback            │
│ GET  /api/gabarito/[id] │ só após a tentativa fechada        │
│                         │                                    │
│          ┌──────────────▼─────────────┐                      │
│          │ ENDPOINT DE EXECUÇÃO       │                      │
│          │ rota A: função Python      │                      │
│          │ rota B: Pyodide no Node    │                      │
│          └────────────────────────────┘                      │
└───────────────────────────┬──────────────────────────────────┘
                            │ chave de serviço
┌───────────────────────────▼──────────────────────────────────┐
│ SUPABASE · Postgres + Auth + RLS                             │
│ usuarios · temas · categorias_defeito · programas_base       │
│ exercicios · dicas · tentativas · eventos                    │
└──────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────┐
   │ /pipeline — Python, offline              │
   │ mutadores AST → valida com testes        │
   │ lê o conteúdo do repositório privado     │
   │ → popula programas_base, exercicios,     │
   │   dicas                                  │
   └──────────────────────────────────────────┘
```

Toda escrita em `tentativas` e `eventos` passa pelos endpoints, com a chave de serviço. O cliente nunca escreve nessas tabelas diretamente. Isso é o que impede o aluno de forjar um `localizou` correto ou uma pontuação (ver Modelo de Dados, seção 5).

### 4.2 Decisões arquiteturais

**DA-01 · Next.js com TypeScript, não FastAPI com Python.** O aluno já entregou um projeto com Next + Vercel + Supabase. O cliente JavaScript do Supabase é o mais bem documentado da plataforma, e CodeMirror e Pyodide são bibliotecas JavaScript, integradas como componentes naturais em React. O Python do projeto é todo offline e não depende dessa escolha.

**DA-02 · Geração de exercícios por mutação determinística de AST, sem IA.** Mutação sintática garante que a linha do defeito seja conhecida com exatidão — ela é a verdade fundamental contra a qual se avalia o diagnóstico do aluno. Um gerador baseado em modelo de linguagem introduziria incerteza justamente onde não pode haver.

**DA-03 · Precheck no navegador, Verificar no servidor.** O teste de exemplo já está visível na tela, então não há segredo a proteger e ele pode rodar em Pyodide no cliente — resposta instantânea, custo zero, e o isolamento é responsabilidade do navegador. A suíte oculta não pode ir ao cliente, sob pena de ser lida no DevTools, o que anularia a distinção entre os dois botões.

**DA-04 · Dicas escritas à mão por categoria, não geradas em tempo real.** Como cada exercício nasce rotulado com sua categoria, 12 textos fixos cobrem todos os exercícios da v1. Elimina custo por uso, latência, risco de alucinação e a necessidade de guarda-corpos contra vazamento da resposta.

**DA-05 · IA restrita ao feedback final.** É o único ponto do sistema cujo conteúdo depende do que aquele aluno específico digitou. As tentativas erradas possíveis são infinitas, logo o texto não pode ser pré-escrito.

**DA-06 · Eventos como fonte da verdade; pontuação derivada.** Toda ação do aluno vira uma linha imutável na tabela `eventos`, gravada pelo servidor. A pontuação de uma tentativa é uma função desses eventos, e o campo `tentativas.pdr_final` é um cache reconstruível. Isso permite auditar a composição de qualquer nota e ajustar os pesos da fórmula sem perder o histórico.

**DA-07 · Segredo do exercício vive no servidor.** Três informações resolvem o exercício e nunca podem chegar ao cliente antes do encerramento: a suíte oculta, o código correto, a linha do defeito. Uma quarta, a categoria do defeito, equivale à dica de nível 1 e também fica retida. O cliente recebe apenas o que precisa para exibir a tela.

### 4.3 O risco técnico a resolver antes de tudo

Executar código enviado pelo aluno é executar código não confiável. Há duas rotas possíveis para o endpoint do Verificar, e nenhuma está verificada:

**Rota A — função Python com subprocess.** A Vercel permite misturar runtimes num mesmo projeto. O processo roda com ambiente limpo (`env={}`), para que o código do aluno não consiga ler a chave de serviço do Supabase, com timeout de 5 segundos e diretório temporário.

**Rota B — Pyodide no servidor, dentro de um route handler do Node.** Mantém runtime único e oferece isolamento mais forte: sandbox WASM, sem sistema de arquivos e sem acesso a variáveis de ambiente. O risco é o tempo de carga em partida a frio.

**Plano de ação:** testar as duas em até 4 horas e adotar a que funcionar, preferindo a B. Se ambas falharem, o plano C é executar o Verificar em Pyodide no cliente, buscando a suíte oculta apenas no momento do clique e sem cacheá-la — solução que protege contra o aluno casual, não contra o determinado, e que deve ser declarada como limitação.

## 5. Regras de negócio

### RN-01 · Localização do defeito

O editor de código inicia bloqueado. O aluno dispõe de duas tentativas de localização.

| SITUAÇÃO | FATOR DE LOCALIZAÇÃO | EFEITO |
|---|---|---|
| acertou na 1ª tentativa | 1,0 | editor destrava |
| errou a 1ª, acertou na 2ª | 0,6 | editor destrava |
| errou as duas | 0,3 | editor destrava automaticamente |
| localização não concluída (desistiu sem nenhum clique, ou após um único erro) | 0,3 | — |

A última linha existe para que o cálculo do PDR não quebre quando a tentativa é encerrada por desistência antes de a localização terminar — sem evento `localizou` ou com um único evento incorreto (D-17). Não afeta a nota, porque a desistência zera o PDR.

A linha correta é `exercicios.linha_defeito`. A comparação é feita no servidor — o cliente envia a linha clicada e recebe apenas "correta" ou "incorreta".

### RN-02 · Precheck

Executa exclusivamente o teste de exemplo, no navegador, com limite de 2 segundos. Limitado a 3 usos por tentativa, contando também as execuções que estouram o tempo. Não altera a pontuação. Após o terceiro uso, o botão fica desabilitado.

O limite de 2 segundos conta só a execução. O Pyodide é carregado uma vez, no carregamento da página, e o worker é mantido vivo; o relógio começa quando o código é despachado a um worker já inicializado. Se a carga ainda estiver em andamento quando o aluno clicar, o sistema mostra "preparando o ambiente" e o uso não é consumido.

### RN-03 · Verificar

Executa a suíte oculta completa, no servidor, com limite de 5 segundos.

- Se todos os testes passam, a tentativa é encerrada com desfecho `resolvido`.
- Caso contrário — teste falho, tempo excedido ou erro de execução — o fator de reparo é reduzido em 0,25 em termos absolutos, com piso em 0, e as dicas de nível 2 e 3 são liberadas.

O resultado exibido informa quantos testes passaram do total, sem revelar o conteúdo dos testes.

### RN-04 · Dicas

Três níveis, de revelação crescente, obtidos pelo servidor a partir da categoria do exercício.

| NÍVEL | CONTEÚDO | MULTIPLICADOR | CONDIÇÃO DE LIBERAÇÃO |
|---|---|---|---|
| 1 | a natureza do defeito, sem localizá-lo | 0,85 | editor já destravado |
| 2 | a região do código | 0,65 | dica 1 usada e ao menos um Verificar sem sucesso |
| 3 | quase a correção completa | 0,40 | dica 2 usada |

As dicas são sequenciais e o multiplicador não é cumulativo — vale o do nível mais alto já usado.

A dica 1 exige o editor destravado porque ela revela a natureza do defeito, o que ajudaria a localizar a linha e contornaria a separação entre diagnóstico e reparo descrita na seção 1.2.

### RN-05 · Pontuação (PDR)

```
PDR = base × (0,4 × fator_localização + 0,6 × fator_reparo)
           × multiplicador_dica × multiplicador_repeticao
```

| COMPONENTE | ORIGEM |
|---|---|
| `base` | 100 se o nível da categoria é baixo, 200 se é médio |
| `fator_localização` | eventos `localizou`, conforme RN-01; 0,3 se a localização não foi concluída (D-17) |
| `fator_reparo` | inicia em 1,0; −0,25 por evento `verificar` sem sucesso; piso 0 |
| `multiplicador_dica` | maior nível de evento `dica`, conforme RN-04 |
| `multiplicador_repeticao` | 1,0 se `numero_tentativa` é 1; 0,5 se maior |

O resultado é arredondado para o inteiro mais próximo, com empate sempre para cima (meio-para-cima): 42,5 → 43 (D-16). Atenção a portes para Python: `round()` do Python faz arredondamento bancário (`round(42.5) == 42`); use `math.floor(x + 0.5)`.

**Assinatura da função de cálculo.** Três dos cinco componentes vêm dos eventos; `base` e `multiplicador_repeticao` não. A função é, portanto:

```
calcularPdr(eventos, { base, numero_tentativa }) → inteiro
```

É pura: mesmos argumentos, mesmo resultado, sem consultar o banco. Isso é o que permite recalcular o histórico inteiro quando os pesos mudarem.

**Escopo.** O PDR é local à tentativa. Nenhum exercício anterior entra no cálculo.

**Exemplo trabalhado.** Nível médio, primeira tentativa. O aluno erra a linha 6, acerta a linha 4, usa a dica 1, falha um Verificar e passa no segundo:

```
PDR = 200 × (0,4 × 0,6 + 0,6 × 0,75) × 0,85 × 1,0
    = 200 × (0,24 + 0,45) × 0,85
    = 200 × 0,69 × 0,85
    = 117
```

**PDR acumulado.** Soma dos `pdr_final` das tentativas do aluno, obtida por consulta. Não existe coluna de total acumulado.

### RN-06 · Desistência

Ao desistir, a tentativa é encerrada com desfecho `desistiu` e `pdr_final = 0`. A ação exige confirmação explícita e é irreversível para aquela tentativa.

Desistir está disponível desde o início da tentativa, inclusive com o editor travado (D-17). Bloquear criaria um beco sem saída: como a tentativa aberta não expira, a única fuga seria fechar a aba e voltar sempre para a mesma. O placar já desencoraja o abuso — desistir dá PDR 0 e refazer vale metade, então desistir para ver o gabarito e refazer rende no máximo 50% do que resolver direto.

### RN-07 · Repetição de exercício

Um exercício pode ser tentado quantas vezes o aluno quiser. Toda tentativa após a primeira aplica `multiplicador_repeticao = 0,5`, independentemente do desfecho da anterior.

### RN-08 · Limite de edição

O sistema conta as linhas alteradas em relação ao código original — o `codigo_com_defeito` que o aluno recebeu, nunca o `codigo_correto` — e exibe o contador, com alerta visual acima de 3 linhas. Na v1 o limite é informativo: não bloqueia nem penaliza. O número é registrado no evento `editou`.

A contagem é um diff linha a linha: cada linha modificada, inserida ou removida conta 1.

### RN-09 · Seleção do próximo exercício

Dentro de um tema e nível, na ordem:

1. Se houver tentativa com desfecho `aberto`, retomá-la (RN-10).
2. Senão, o exercício não resolvido de menor `ordem`.
3. Senão, o exercício de menor `ordem`, sujeito a RN-07.

Os passos 2 e 3 consideram apenas exercícios com `ativo = true` (D-21). O passo 1 não filtra por `ativo`: uma tentativa aberta num exercício desativado por uma versão nova do mutador continua sendo retomada, porque ela existe e o aluno já recebeu aquele código.

### RN-10 · Tentativa em aberto

Se o aluno fecha a página no meio de uma tentativa, ela permanece com desfecho `aberto`. Ao voltar, a tentativa é retomada no estado reconstruído a partir dos eventos. Não há expiração automática na v1. Só pode existir uma tentativa aberta por aluno e exercício.

### RN-11 · Numeração das tentativas

`numero_tentativa` é atribuído pelo servidor como o maior valor existente para aquele par aluno-exercício, mais um. A atribuição ocorre dentro da transação que cria a tentativa, e a restrição de unicidade no banco é a garantia final contra corrida.

### RN-12 · Registro do código submetido

O evento `editou` é gravado sempre que o aluno aciona Precheck, Verificar ou Encerrar, com o conteúdo atual do editor. Isso garante que sempre exista um código submetido para o feedback final, mesmo quando o aluno edita e desiste sem testar.

## 6. Pipeline de geração de exercícios

Roda na máquina do aluno, em Python, na pasta `/pipeline`. Não é publicado.

**Código e conteúdo vivem em repositórios separados (D-22).** O repositório do projeto é público e contém apenas código: a aplicação, os mutadores, as migrations e esta documentação. O conteúdo que resolve os exercícios — os programas-base com `codigo_correto`, `teste_exemplo` e `suite_oculta`, e os textos das dicas — vive num repositório privado à parte, `BugHunter-conteudo`, que o pipeline lê a partir do caminho indicado em `CONTEUDO_DIR`. A aplicação publicada nunca precisa desse repositório: ela lê tudo do banco. Nenhum arquivo de conteúdo, e nenhuma saída do pipeline que contenha `codigo_correto`, `suite_oculta`, `linha_defeito` ou categoria por exercício, é gravado no repositório público.

### 6.1 Algoritmo

```
MUTADOR_VERSAO = "1.0.0"

para cada programa_base P:
    para cada categoria C aplicável a P:

        canonico ← ast.unparse(ast.parse(P.codigo))   # normaliza antes de comparar
        n        ← conta_ocorrencias(canonico, C)     # quantos nós C pode mutar

        para ocorrencia i em 1..n:
            candidato ← ast.unparse(MutadorDe(C, alvo=i).visit(ast.parse(P.codigo)))

            se candidato == canonico:                 # mutação não teve efeito
                descartar

            se não compila(candidato):
                descartar

            se todos_passam(candidato, P.suite_oculta):
                descartar                             # mutação inócua

            linha ← primeira_linha_divergente(canonico, candidato)
            id    ← uuid5(NAMESPACE, f"{P.id}|{C.codigo}|{i}|{MUTADOR_VERSAO}")

            gravar exercicio(
                id, P.id, C.codigo,
                codigo_com_defeito = candidato,
                linha_defeito      = linha,
                mutador_versao     = MUTADOR_VERSAO)

atribuir ordem: dentro de cada nível, permutação pseudoaleatória
                com semente fixa dos exercícios gravados (D-20)

marcar ativo = false os exercícios de versões anteriores de MUTADOR_VERSAO
                (não são apagados; D-21)
```

Detalhes que parecem menores e não são:

**A comparação é sempre contra o código canônico, nunca contra o texto-fonte original.** `ast.unparse` normaliza aspas, parênteses, espaçamento e descarta comentários. Comparar o mutado com o fonte original faria a primeira divergência cair na linha 1 quase sempre — e `linha_defeito` é a verdade fundamental do diagnóstico. É por isso que `programas_base.codigo_correto` armazena a forma canônica, não o texto como foi digitado.

**A verificação de compilação vem antes de rodar os testes.** Um candidato que nem carrega não tem resultado de teste a consultar.

**O identificador é derivado por uuid5 de uma chave natural, não sorteado.** Rodar o pipeline duas vezes produz os mesmos identificadores, o que torna a carga idempotente e satisfaz o requisito de reprodutibilidade.

**A `ordem` é embaralhada, com semente fixa.** Uma ordem derivada de (tema, nível, função, categoria, ocorrência) revelaria o agrupamento por programa-base e por categoria a quem observasse a sequência. A permutação com semente fixa esconde esse agrupamento e continua reprodutível (RNF-08).

**Uma versão nova de mutador não apaga exercícios antigos.** Como `mutador_versao` entra na chave do uuid5, regerar com versão nova produz identificadores novos. Os antigos são marcados `ativo = false`, o que preserva as tentativas históricas que os referenciam.

### 6.2 Especificação dos mutadores

Cada mutador recebe um parâmetro `alvo` e altera exatamente o n-ésimo nó elegível, deixando os demais intactos. Sem esse parâmetro, um `NodeTransformer` alteraria todas as ocorrências e plantaria vários defeitos no mesmo exercício.

| CÓDIGO | NÓ ELEGÍVEL | TRANSFORMAÇÃO |
|---|---|---|
| `CMP_INV` | `ast.Compare` | primeiro operador: `Lt` ↔ `LtE` , `Gt` ↔ `GtE` |
| `ARIT_TROC` | `ast.BinOp` ou `ast.AugAssign` | `Add` ↔ `Sub` , `Mult` ↔ `Div`, sobre o operador do nó |
| `LACO_DESL` | `ast.Call` a `range` | subtrai 1 do argumento `stop`: índice 0 se o `range` tem um argumento, índice 1 se tem dois ou três |
| `ACUM_AUSENTE` | `ast.AugAssign` ou `ast.Assign` dentro de laço | remove o nó |

Regras complementares:

- **`LACO_DESL`** escolhe o argumento pela aridade: `alvo = 0 if len(node.args) == 1 else 1`. O passo nunca é tocado. A operação é sempre "subtrair 1", sem ramo pelo sinal do passo: com passo positivo o laço roda uma vez a menos; com passo negativo, uma a mais. Os dois são deslocamento de limite (D-18). Por isso os textos de dica de `LACO_DESL` são neutros quanto à direção.
- **`ARIT_TROC`** percorre `ast.BinOp` e `ast.AugAssign` numa travessia única e determinística, contando ambos na mesma sequência de ocorrências. Contagens separadas tornariam o parâmetro `alvo` instável entre execuções e quebrariam a idempotência do uuid5 (D-19).
- **O mesmo nó pode ser elegível para duas categorias.** Um `ast.AugAssign` dentro de laço é elegível para `ARIT_TROC` e para `ACUM_AUSENTE`. Isso é intencional e gera dois exercícios diferentes.

Implementação de referência, com a contagem de ocorrências:

```python
class InverteComparador(ast.NodeTransformer):
    TROCA = {ast.Lt: ast.LtE, ast.LtE: ast.Lt,
             ast.Gt: ast.GtE, ast.GtE: ast.Gt}

    def __init__(self, alvo):
        self.alvo = alvo            # 1-indexado
        self.vistos = 0

    def visit_Compare(self, node):
        self.generic_visit(node)
        if type(node.ops[0]) in self.TROCA:
            self.vistos += 1
            if self.vistos == self.alvo:
                node.ops[0] = self.TROCA[type(node.ops[0])]()
        return node
```

### 6.3 Critérios de validade

Um candidato só vira exercício se satisfizer todos os itens:

1. O código mutado difere do canônico.
2. O código mutado compila.
3. O código mutado falha em ao menos um teste da suíte oculta.
4. Exatamente um nó da árvore foi alterado. O critério é sobre o nó, não sobre linhas de texto: `ACUM_AUSENTE` remove uma linha e desloca todas as seguintes, o que é esperado e não invalida o exercício.

Não se exige que o código mutado passe no teste de exemplo (D-12). Um candidato que quebra o exemplo é válido; o exemplo não é trocado, para que todos os exercícios do mesmo programa-base mostrem o mesmo exemplo.

**Regra de autoria, verificada na S1-08.** Toda suíte oculta contém ao menos um caso de borda não coberto pelo teste de exemplo. É isso que garante que passar no Precheck não garante passar no Verificar — a distinção entre os dois botões é propriedade de como os testes são escritos, não filtro sobre cada mutação. O Precheck, além disso, fica desabilitado enquanto o editor está travado (RF-07), e portanto não ajuda na localização.

**Propriedade desejável do banco.** Exercícios cujo defeito passa no exemplo e só aparece na borda — como `conta_aprovados` com `CMP_INV` — são os mais valiosos, porque ensinam que o teste visível não prova nada. O pipeline reporta quantos exercícios têm essa característica.

Para `ACUM_AUSENTE`, `linha_defeito` aponta a linha imediatamente anterior ao ponto da remoção no código mutado, que é onde o aluno precisa olhar para perceber a falta.

## 7. Feedback final gerado por IA

### 7.1 Quando é acionado

Ao encerramento de uma tentativa, tanto por `resolvido` quanto por `desistiu`.

### 7.2 Entrada fornecida ao modelo

| ITEM | ORIGEM |
|---|---|
| código correto | `programas_base.codigo_correto` |
| código com o defeito | `exercicios.codigo_com_defeito` |
| linha do defeito | `exercicios.linha_defeito` |
| categoria e sua descrição | `categorias_defeito` |
| código final submetido | último evento `editou` (garantido por RN-12) |
| histórico de ações | eventos da tentativa, em ordem |

### 7.3 Saída esperada

Texto em português, em três partes:

1. **Qual era o defeito** — categoria e diferença entre o plantado e o correto.
2. **Por que passa despercebido** — a característica que o torna difícil de ver.
3. **Onde o raciocínio falhou** — análise da tentativa daquele aluno, quando houve correção submetida.

### 7.4 Limites e tratamento de falha

O texto é gerado uma vez, no encerramento, e armazenado em `tentativas.feedback_texto`. Não é regerado a cada visualização.

Se a chamada falhar ou exceder 15 segundos, o sistema exibe um feedback de reserva montado com os dados estruturados — categoria, `descricao_curta`, e o diff entre plantado e correto — sem análise da tentativa. O encerramento nunca é bloqueado por falha na geração.

## 8. Telas

| # | TELA | PROPÓSITO | V1 |
|---|---|---|---|
| 1 | Login | autenticação | sim |
| 2 | Escolha do tema | seleção de tema | sim |
| 3 | Nível de dificuldade | seleção de nível | sim |
| 4 | Exercício — editor travado | etapa de localização | sim |
| 5 | Exercício — editor liberado | edição e testes | sim |
| 6 | Exercício — resultado do precheck | retorno do teste de exemplo | sim |
| 7 | Feedback final | encerramento da tentativa | sim |
| 8 | Progresso por categoria | desempenho do aluno | não |
| 9 | Ranking semanal e elo | comparação entre alunos | não |

As telas 4, 5 e 6 são a mesma rota em estados diferentes, não três páginas distintas.

## 9. Decisões tomadas na redação desta documentação

Pontos que não haviam sido discutidos e foram resolvidos aqui. Merecem validação antes da implementação.

| # | PONTO | DECISÃO | ALTERNATIVA DESCARTADA |
|---|---|---|---|
| D-01 | Tentativas de localização | duas; na segunda falha destrava com fator 0,3 | três cliques |
| D-02 | Limite de linhas editadas | informativo, sem bloqueio nem penalidade | bloquear ou penalizar |
| D-03 | Repetição de exercício | ilimitada, multiplicador 0,5 fixo | decaimento progressivo |
| D-04 | Ordem dos exercícios | fixa, atribuída pelo pipeline (permutação com semente fixa, D-20) | aleatória por aluno ou a cada execução, ou adaptativa |
| D-05 | Momento do feedback | ao resolver e ao desistir | só ao desistir |
| D-06 | Persistência do feedback | gerado uma vez e armazenado | regerado a cada visita |
| D-07 | Confirmação de e-mail | desativada na v1 | exigir confirmação |
| D-08 | Dica 1 com editor travado | não liberada; exige localização feita | sempre disponível |
| D-09 | Verificar com tempo excedido | conta como sem sucesso: −0,25 e libera dicas | não penalizar |
| D-10 | Precheck com tempo excedido | consome um dos 3 usos | não consumir |
| D-11 | Mutação por ocorrência | um exercício por nó elegível | um exercício por par programa-categoria |
| D-12 | Teste de exemplo quebrado pela mutação | o candidato é válido: não se descarta nem se troca o exemplo. A distinção entre Precheck e Verificar é garantida por regra de autoria — a suíte oculta contém ao menos um caso de borda fora do exemplo | exigir que o defeito preserve o exemplo, o que reduziria o banco a 3–6 exercícios e dependeria de sorte na escolha do exemplo |
| D-13 | Identificadores dos exercícios | uuid5 de chave natural, idempotente | `gen_random_uuid()` |
| D-14 | Programas-base | entidade própria, com o tema | replicados em cada exercício |
| D-15 | Evento de encerramento | tipo único `encerrou` com o desfecho | `desistiu` mais inferência |
| D-16 | Arredondamento do PDR | meio-para-cima; 42,5 → 43. Em contexto educacional o empate favorece o aluno | arredondamento bancário |
| D-17 | Desistir com o editor travado | disponível desde o início; com a localização não concluída — nenhum evento `localizou`, ou um único incorreto — o fator de localização é 0,3. Bloquear criaria um beco sem saída, e o placar já torna a desistência estritamente dominada | exigir localização antes de poder sair |
| D-18 | Alvo do `LACO_DESL` | o argumento `stop`, escolhido pela aridade do `range`, sempre com subtração de 1. É o limite que a categoria descreve | o último argumento posicional, que em `range` de 3 argumentos é o passo |
| D-19 | Escopo do `ARIT_TROC` | aceita `ast.AugAssign` além de `ast.BinOp`. `contador += 1` é como código real se escreve | escrever os programas-base na forma `x = x + 1` para caber no mutador |
| D-20 | Entrega do código do exercício | só pela resposta de `/api/tentativa`; a view `exercicios_publicos` é removida; as contagens vêm por agregados; a `ordem` é embaralhada com semente fixa. Com todos os códigos em mãos, comparar os irmãos de um programa-base reconstruiria o código correto e a linha do defeito | manter a view e registrar o vazamento como limitação |
| D-21 | Versionamento dos exercícios | coluna `ativo` com índice único parcial sobre `ordem`, substituindo a unicidade global. Versões antigas são desativadas, não apagadas, preservando as tentativas históricas | `ordem` única para sempre, que colide quando `mutador_versao` muda |
| D-22 | Onde vive o conteúdo dos exercícios | repositório privado `BugHunter-conteudo`, separado do repositório público de código e lido só pelo pipeline. O histórico do git é permanente: conteúdo publicado uma vez não se desfaz movendo-o depois | conteúdo no repositório público, movido para um privado ao fim da implementação |

D-12 foi revista e D-16 a D-22 foram acrescentadas pelo P.O. na revisão da especificação da versão 1.2.

## 10. Riscos

| # | RISCO | PROB. | IMPACTO | MITIGAÇÃO |
|---|---|---|---|---|
| R-01 | Nenhuma rota de execução do Verificar funciona na Vercel | média | alto | spike na primeira semana; plano C no cliente |
| R-02 | Mutações geram poucos exercícios válidos | média | médio | acrescentar programas-base |
| R-03 | Supabase pausado por inatividade | alta | baixo | cron diário no GitHub Actions |
| R-04 | Feedback da IA impreciso | média | médio | dados estruturados no prompt; reserva; revisão dos primeiros casos |
| R-05 | Partida a frio do Pyodide no servidor | média | médio | medir no spike; usar a rota A se inviável |
| R-06 | Escopo volta a crescer | alta | alto | este documento define o escopo |

## 11. Glossário

| TERMO | SIGNIFICADO |
|---|---|
| AST | Abstract Syntax Tree. Representação em árvore da estrutura de um programa. |
| Categoria de defeito | Classificação do tipo de erro plantado. Define o nível e as dicas. |
| Código canônico | Saída de `ast.unparse` sobre o programa correto. É a forma armazenada e a base de toda comparação. |
| Desfecho | Como uma tentativa terminou: `resolvido`, `desistiu` ou `aberto`. |
| Evento | Registro imutável de uma ação do aluno, gravado pelo servidor. |
| Mutador | Rotina que altera um nó da AST para plantar um defeito de categoria específica. |
| Ocorrência | Índice do nó elegível dentro do programa. Um exercício por ocorrência. |
| PDR do exercício | Pontos obtidos numa tentativa. Teto de 100 no nível baixo, 200 no médio. |
| PDR acumulado | Soma dos PDR das tentativas do aluno. Sem teto, não armazenado. |
| Precheck | Execução do teste de exemplo, no navegador, sem custo de pontos. |
| Programa-base | Função Python correta, com teste de exemplo e suíte oculta, da qual os exercícios derivam. |
| Pyodide | Python compilado para WebAssembly, executável no navegador. |
| Suíte oculta | Conjunto completo de testes, com casos de borda, que o aluno nunca vê. |
| Tentativa | Uma passagem do aluno por um exercício, do início ao encerramento. |
| Verificar | Execução da suíte oculta, no servidor, com custo de pontos em caso de insucesso. |

# BugHunter

Plataforma educacional de depuração. O aluno recebe uma função Python com um defeito plantado, aponta a linha do
defeito, corrige o código, testa e recebe uma explicação personalizada do que errou.

Produção: https://bug-hunter-alpha.vercel.app · Especificação: [`docs/`](docs/README.md).

| Pasta | Conteúdo |
|---|---|
| `app/` | aplicação Next.js 16 (App Router, TypeScript, Tailwind), publicada na Vercel |
| `executor/` | executor do Verificar em Python, publicado num **segundo** projeto Vercel, sem credenciais (DA-08) |
| `supabase/migrations/` | esquema, permissões e funções do banco, em ordem |
| `supabase/testes/` | testes das migrations num Postgres 17 real e descartável, e a auditoria do banco publicado |
| `pipeline/` | gera e carrega os exercícios a partir do conteúdo privado; roda offline |
| `docs/` | documentação, requisitos, modelo de dados, sprints e relatórios das atividades |
| `.github/workflows/` | rotina diária que mantém o banco ativo (RNF-06) |

## Como as peças conversam

```
navegador ──► app (Vercel, gru1) ──► Supabase (sa-east-1)
   │               │
   │               └──► executor (Vercel, gru1): só código, função e entradas; devolve os valores obtidos
   └── Precheck: Pyodide num Web Worker, servido pelo próprio domínio
```

O navegador só fala com o Supabase para autenticação. Tudo o que envolve o exercício passa pelas rotas
`/api/*` do app, que usam a chave de serviço e as funções do banco. Os quatro campos secretos (`suite_oculta`,
`codigo_correto`, `linha_defeito`, `categoria_codigo`) nunca saem antes do encerramento (RNF-03), e o esperado
da suíte nunca chega ao executor: a comparação é feita no app (D-26).

## Variáveis de ambiente

Nenhum arquivo `.env` é versionado. Os modelos são `app/.env.example` e `pipeline/.env.example`.

**`app/.env.local`, e no projeto Vercel principal (Production e Preview):**

| Variável | Para quê | Vai ao navegador? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL raiz do projeto Supabase (sem `/rest/v1`) | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave publishable (`sb_publishable_…`), protegida por grants e RLS | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secret (`sb_secret_…`), só no servidor | **nunca** |
| `FEEDBACK_API_KEY` | chave da API Gemini, para o feedback final | **nunca** |
| `FEEDBACK_MODEL` | modelos em ordem, separados por vírgula: `gemini-3.1-flash-lite,gemini-3.5-flash-lite` | não |
| `EXECUTOR_URL` | `https://<executor>.vercel.app/api/executar` | não |
| `EXECUTOR_SEGREDO` | segredo compartilhado com o executor | **nunca** |

**Projeto Vercel do executor:** só `EXECUTOR_SEGREDO`, o mesmo valor. Deployment Protection desligada (o
executor exige o segredo por conta própria). Nenhuma outra variável.

**`.env` na raiz:** `SUPABASE_DB_URL`, a conexão Postgres, usada só pela CLI do Supabase e pela auditoria do banco.

**`pipeline/.env`:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `CONTEUDO_DIR`.

Para gerar um segredo: `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

## Rodar localmente

```bash
cd app
npm install
npm run dev                      # http://localhost:3000; o predev copia o Pyodide para public/pyodide
python ../executor/servidor_local.py   # executor em http://127.0.0.1:3071/api/executar (outro terminal)
```

Para o Verificar local, use `EXECUTOR_URL=http://127.0.0.1:3071/api/executar` no `app/.env.local`. No Windows, o
executor local não tem os limites de memória e de arquivo do Linux; o isolamento real é o da Vercel.

## Testes

| Onde | Comando | O que cobre |
|---|---|---|
| `app/` | `npm test` · `npm run lint` · `npx tsc --noEmit` | regras puras: estado, PDR, comparação D-27, dicas, feedback, Precheck com Pyodide real |
| `supabase/testes/` | `npm install` e `npm test` | todas as migrations num Postgres 17 descartável, com concorrência e auditoria de privilégios |
| `executor/` | `python -m unittest discover -s tests -t .` | execução, formato dos valores, recusas |
| `pipeline/` | `python -m unittest -v` | mutadores, validação, carga |

Auditorias da versão publicada (S6-02), para repetir a cada publicação:

```bash
node supabase/testes/auditoria-producao.mjs                  # banco: privilégios e acesso direto com a chave pública
node app/scripts/auditoria-publicada.mjs                     # app: rotas sem login, HTML e JavaScript entregues
python executor/tests/isolamento_remoto.py https://bughunter-executor.vercel.app/api/executar   # precisa de EXECUTOR_SEGREDO
node app/scripts/medir-tempos.mjs                            # tempos e região das funções (RNF-02)
```

## Conteúdo dos exercícios

Os programas-base, as suítes ocultas e as dicas ficam no repositório **privado** `BugHunter-Data` (D-22), nunca
neste. Para trabalhar com eles:

1. Peça acesso ao repositório privado e clone-o fora desta pasta (por exemplo, ao lado: `../BugHunter-conteudo`).
2. Em `pipeline/.env`, aponte `CONTEUDO_DIR` para essa pasta. O pipeline recusa uma pasta dentro deste repositório.
3. Dentro de `pipeline/`, com Python 3.12:

```bash
python -m bughunter_pipeline validar     # confere o conteúdo, sem tocar no banco
python -m bughunter_pipeline dicas       # grava as dicas
python -m bughunter_pipeline gerar       # mostra os candidatos a exercício, sem gravar
python -m bughunter_pipeline carregar    # grava programas e exercícios; desativa os que saíram (D-21)
```

Detalhes e o formato de um programa-base: [`pipeline/README.md`](pipeline/README.md).

## Publicar

1. **Banco:** aplicar as migrations novas com a CLI do Supabase, a partir da raiz:
   `npx supabase@2.118.0 db push --db-url "$SUPABASE_DB_URL"`. Elas são aplicadas em ordem e nunca editadas
   depois de publicadas; uma mudança vira uma migration nova.
2. **App e executor:** a Vercel publica a cada merge na `main`. O projeto principal tem Root Directory `app`; o do
   executor, Root Directory `executor`. Os dois rodam em `gru1`, junto do banco (`vercel.json` de cada pasta).
3. **Depois de publicar:** rodar as auditorias acima.
4. **Rotina diária:** `.github/workflows/manter-ativo.yml` chama `/api/saude` todo dia, o que mantém o Supabase
   ativo no plano gratuito. O GitHub desativa rotinas agendadas de repositórios sem commits por 60 dias; nesse
   caso, reative em Actions.

## Limitações conhecidas

- **Executor:** o processo do aluno consegue abrir o ambiente do processo pai, que só contém `EXECUTOR_SEGREDO`;
  com ele, alguém poderia chamar o executor diretamente, o que só roda código sem acesso a nada. Execuções
  simultâneas na mesma instância poderiam ver os arquivos temporários umas das outras por frações de segundo.
  O processo do aluno pode abrir conexões de rede, mas não há credencial nenhuma para levar.
- **Precheck:** roda no navegador, então o aluno pode testar o exemplo quantas vezes quiser por fora; o limite de
  3 vale para os usos registrados.
- **Coleção de exercícios:** abrir tentativas mostra os códigos com defeito; nenhum dos quatro campos secretos sai.
- **Plano gratuito:** o modelo de feedback pode estar sobrecarregado; quando os dois modelos da lista falham em
  15 s, a tela mostra o feedback de reserva (categoria e diferença entre plantado e correto), sem análise da tentativa.
- **Fora da v1** (Requisitos §6): ranking, elo, perfil, recuperação de senha, histórico, nível Alto e os temas
  além de Fundamentos.

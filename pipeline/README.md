# Pipeline de geração de exercícios

Roda offline, na máquina do autor do conteúdo. Nunca é publicado.
Especificação: Documentação do Projeto, seção 6.

- **Python 3.12**, a mesma versão do executor do Verificar (DA-08). Só biblioteca padrão.
- **Conteúdo** (programas-base e dicas) vem do repositório privado `BugHunter-Data`, apontado
  por `CONTEUDO_DIR` em `pipeline/.env` (D-22). O pipeline recusa uma pasta dentro deste repositório.
- **Gravação** no Supabase pela API REST, com a chave de serviço.

## Configuração

Copie `.env.example` para `.env` e preencha `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `CONTEUDO_DIR`.

## Comandos (rodar dentro de `pipeline/`)

| Comando | O que faz |
|---|---|
| `python -m bughunter_pipeline validar` | valida o conteúdo sem tocar no banco |
| `python -m bughunter_pipeline dicas` | grava as 12 dicas e confere exatamente 3 por categoria (Modelo §4.1) |
| `python -m bughunter_pipeline programas` | grava os programas-base |
| `python -m bughunter_pipeline gerar` | avalia os candidatos a exercício e mostra o relatório, sem gravar |
| `python -m bughunter_pipeline carregar` | grava programas-base e exercícios; desativa os que não saíram desta geração (D-21) |
| `python -m unittest -v` | roda os testes |

Todas as cargas são idempotentes: rodar duas vezes atualiza as linhas em vez de duplicá-las (RNF-08).

## Formato de um programa-base (`programas_base/<nome_funcao>.json` no repositório privado)

```json
{
  "tema_codigo": "fundamentos",
  "nome_funcao": "media_das_notas",
  "assinatura": "media_das_notas(notas)",
  "descricao": "Recebe uma lista de notas e devolve a média aritmética.",
  "codigo": "def media_das_notas(notas):\n    ...",
  "categorias": ["CMP_INV", "ARIT_TROC", "LACO_DESL", "ACUM_AUSENTE"],
  "teste_exemplo": {"chamada": "media_das_notas([7, 8, 9])", "entrada": [[7, 8, 9]], "esperado": 8.0},
  "suite_oculta": [{"entrada": [[10]], "esperado": 10.0}]
}
```

`entrada` é a lista de argumentos da chamada. A suíte é uma lista de casos (D-26), e a comparação
com o esperado segue a regra da D-27, com casos de referência em `tests/dados/comparacao.json`.
Ao carregar, o pipeline confere se o código correto passa no exemplo e na suíte, e se a suíte tem
ao menos um caso fora do exemplo (Documentação §6.3).

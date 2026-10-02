# Testes do banco

Testam as migrations de `supabase/migrations` num **Postgres 17 real e descartável**
(pacote `embedded-postgres`), com várias conexões simultâneas. Não tocam o banco de produção.

```bash
npm install
npm test
```

`banco.mjs` sobe o banco temporário, recria o que o Supabase já traz (schema `auth`,
`auth.uid()`, papéis `anon`/`authenticated`/`service_role` e os privilégios padrão),
aplica as migrations em ordem e apaga tudo ao terminar.

| Arquivo | O que testa |
|---|---|
| `tentativa.test.mjs` | `abrir_tentativa`: as três situações da RN-09 e a RN-11 sob requisições simultâneas (RF-05) |
| `localizacao.test.mjs` | `registrar_localizacao`: RN-01, limite de duas tentativas e concorrência (RF-07) |
| `edicao-precheck.test.mjs` | `registrar_edicao` e `registrar_precheck`: RN-12, limite de 3 usos (RN-02) sob concorrência |
| `verificar.test.mjs` | `suite_da_tentativa` e `registrar_verificar`: encerramento com PDR, recusa de estado incoerente e concorrência (RF-10) |
| `dicas.test.mjs` | `solicitar_dica` e `dicas_da_tentativa`: condições de liberação da RN-04, dica repetida sem novo custo, concorrência (RF-12) |
| `encerramento.test.mjs` | `encerrar_por_desistencia`, `dados_do_encerramento` e `gravar_feedback`: desistência com PDR 0, gabarito só de tentativa encerrada do dono, feedback gravado uma vez (RF-13, RF-15) |
| `refazer.test.mjs` | `refazer_exercicio`: nova tentativa do mesmo exercício com o número incrementado, reaproveita a aberta, concorrência (RF-16) |
| `proximo.test.mjs` | `abrir_proximo`: RN-09 no mesmo tema e nível sem o exercício atual, nível de um exercício só, desativados (D-29) |
| `treino.test.mjs` | `tentativa_e_treino`: repetição de exercício já resolvido fecha com PDR 0; antes de resolver, vale 0,5 (D-31) |
| `auditoria.test.mjs` | RNF-03: varre o catálogo e confere, para `anon` e `authenticated`, exatamente as tabelas, colunas e funções permitidas; nenhum dos quatro segredos é legível (S3-08) |

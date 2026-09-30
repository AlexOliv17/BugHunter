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

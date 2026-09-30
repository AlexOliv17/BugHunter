// S3-08 — auditoria de vazamento no banco (RNF-03). Varre o catálogo inteiro, então
// uma tabela ou função nova que esqueça o revoke faz este teste falhar.
// Os papéis do cliente (anon, authenticated) só podem:
//   - ler temas_publicos; executar progresso_por_tema e niveis_do_tema (authenticated);
//   - ler usuarios e editar só a coluna nome (authenticated, com RLS).
// Nada de suite_oculta, codigo_correto, linha_defeito ou categoria_codigo.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { subirBanco } from "./banco.mjs";

let banco;
before(async () => { banco = await subirBanco(); });
after(async () => { await banco?.encerrar(); });

const PAPEIS = ["anon", "authenticated"];
const SEGREDOS = ["suite_oculta", "codigo_correto", "linha_defeito", "categoria_codigo"];

// o que cada papel pode fazer, e nada além disso
const TABELAS_PERMITIDAS = {
  anon: {},
  authenticated: { temas_publicos: ["SELECT"], usuarios: ["SELECT"] },
};
const COLUNAS_EDITAVEIS = { anon: [], authenticated: ["usuarios.nome"] };
const FUNCOES_PERMITIDAS = {
  anon: [],
  authenticated: ["niveis_do_tema(text)", "progresso_por_tema()"],
};
const PRIVILEGIOS = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];

describe("privilégios dos papéis do cliente, pelo catálogo", () => {
  test("tabelas e views", async () => {
    const { rows } = await banco.admin.query(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')");
    assert.ok(rows.length >= 9, "o catálogo deveria ter as tabelas das migrations");
    for (const papel of PAPEIS) {
      const obtido = {};
      for (const { relname } of rows) {
        for (const p of PRIVILEGIOS) {
          const r = await banco.admin.query("select has_table_privilege($1, $2, $3) ok", [papel, `public.${relname}`, p]);
          if (r.rows[0].ok) (obtido[relname] ??= []).push(p);
        }
      }
      assert.deepEqual(obtido, TABELAS_PERMITIDAS[papel], `privilégios de tabela de ${papel}`);
    }
  });

  test("colunas: os quatro segredos são ilegíveis, e só nome é editável", async () => {
    const { rows } = await banco.admin.query(
      "select table_name, column_name from information_schema.columns where table_schema = 'public'");
    for (const papel of PAPEIS) {
      const editaveis = [];
      for (const { table_name, column_name } of rows) {
        const col = await banco.admin.query(
          "select has_column_privilege($1, $2, $3, 'SELECT') le, has_column_privilege($1, $2, $3, 'UPDATE') edita",
          [papel, `public.${table_name}`, column_name]);
        if (SEGREDOS.includes(column_name)) assert.equal(col.rows[0].le, false, `${papel} lê ${table_name}.${column_name}`);
        if (col.rows[0].edita) editaveis.push(`${table_name}.${column_name}`);
      }
      assert.deepEqual(editaveis, COLUNAS_EDITAVEIS[papel], `colunas editáveis por ${papel}`);
    }
  });

  test("funções (fora as de gatilho, que não se chamam diretamente)", async () => {
    const { rows } = await banco.admin.query(
      `select p.oid::regprocedure::text as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype order by 1`);
    assert.ok(rows.length >= 7, "o catálogo deveria ter as funções das migrations");
    for (const papel of PAPEIS) {
      const obtido = [];
      for (const { assinatura } of rows) {
        const r = await banco.admin.query("select has_function_privilege($1, $2, 'EXECUTE') ok", [papel, assinatura]);
        if (r.rows[0].ok) obtido.push(assinatura);
      }
      assert.deepEqual(obtido, FUNCOES_PERMITIDAS[papel], `funções executáveis por ${papel}`);
    }
  });
});

test("o que o cliente consegue ler não contém nenhum segredo", async () => {
  const q = (sql, p) => banco.admin.query(sql, p);
  const aluno = randomUUID(), tema = "t" + randomUUID().slice(0, 8), prog = randomUUID();
  // marcadores únicos: se aparecerem em qualquer resposta, vazou
  const marca = { suite: "SUITE-" + randomUUID(), correto: "CORRETO-" + randomUUID(), linha: 97531 };
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [aluno, `${aluno}@t`, { nome: "A" }]);
  await q("insert into temas values ($1, $1, 'd', true, (select coalesce(max(ordem), 0) + 1 from temas))", [tema]);
  await q("insert into programas_base values ($1, $2, 'f', 'f(x)', 'd', $3, '{}', $4)", [prog, tema, marca.correto, marca.suite]);
  await q(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
           values (gen_random_uuid(), $1, 'ARIT_TROC', 9000, 'def f(x):\n    return x - 1', $2, '1.0.0')`, [prog, marca.linha]);
  await q("select abrir_tentativa($1, $2, 'baixo')", [aluno, tema]);

  const c = await banco.conectar();
  try {
    await c.query("set role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, false)", [aluno]);
    const respostas = [
      (await c.query("select * from temas_publicos")).rows,
      (await c.query("select * from progresso_por_tema()")).rows,
      (await c.query("select * from niveis_do_tema($1)", [tema])).rows,
      (await c.query("select * from usuarios")).rows,
    ];
    const texto = JSON.stringify(respostas);
    for (const segredo of [...SEGREDOS, marca.suite, marca.correto, String(marca.linha), "ARIT_TROC"]) {
      assert.ok(!texto.includes(segredo), `vazou ${segredo}`);
    }
    // e o que é negado dá erro de permissão, não resultado vazio
    for (const sql of ["select * from exercicios", "select * from programas_base", "select * from tentativas",
      "select * from eventos", "insert into eventos (tentativa_id, tipo, payload) values (gen_random_uuid(), 'encerrou', '{}')"]) {
      await assert.rejects(c.query(sql), { code: "42501" }, sql);
    }
  } finally {
    await c.end();
  }
});

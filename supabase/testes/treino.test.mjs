// D-31 — repetição de exercício já resolvido é treino: fecha com PDR 0.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { subirBanco } from "./banco.mjs";

let banco;
let ordem = 14000;
before(async () => { banco = await subirBanco(); });
after(async () => { await banco?.encerrar(); });

const ORIGINAL = "def f(x):\n    return x - 1";
const q = (sql, p) => banco.admin.query(sql, p);

async function primeira() {
  const aluno = randomUUID(), tema = "t" + randomUUID().slice(0, 8), prog = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [aluno, `${aluno}@t`, { nome: "A" }]);
  await q("insert into temas values ($1, $1, 'd', true, (select coalesce(max(ordem), 0) + 1 from temas))", [tema]);
  await q("insert into programas_base values ($1, $2, 'f', 'f(x)', 'd', 'C', '{}', 'S')", [prog, tema]);
  await q(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
           values (gen_random_uuid(), $1, 'ARIT_TROC', $2, $3, 2, '1.0.0')`, [prog, ordem++, ORIGINAL]);
  const id = (await q("select abrir_tentativa($1, $2, 'baixo') id", [aluno, tema])).rows[0].id;
  return { aluno, id };
}
const resolver = async (aluno, t, pdr) => {
  await q("select registrar_localizacao($1, $2, 2)", [aluno, t]);
  await q("select registrar_verificar($1, $2, 'passou', 1, 1, $3, (select count(*)::int from eventos where tentativa_id = $2))", [aluno, t, pdr]);
};
const desistir = (aluno, t) => q("select encerrar_por_desistencia($1, $2, $3, 0)", [aluno, t, ORIGINAL]);
const refazer = async (aluno, t) => (await q("select refazer_exercicio($1, $2) id", [aluno, t])).rows[0].id;
const treino = async (aluno, t) => (await q("select treino from exercicio_da_tentativa($1, $2)", [aluno, t])).rows[0].treino;
const pdr = async (t) => (await q("select pdr_final from tentativas where id = $1", [t])).rows[0].pdr_final;

describe("treino (D-31)", () => {
  test("1ª tentativa não é treino e pontua", async () => {
    const t = await primeira();
    assert.equal(await treino(t.aluno, t.id), false);
    await resolver(t.aluno, t.id, 100);
    assert.equal(await pdr(t.id), 100);
  });
  test("depois de resolvido, a repetição é treino e fecha com 0, mesmo que o servidor mande outro PDR", async () => {
    const t = await primeira();
    await resolver(t.aluno, t.id, 100);
    const r = await refazer(t.aluno, t.id);
    assert.equal(await treino(t.aluno, r), true);
    await resolver(t.aluno, r, 50);
    assert.equal(await pdr(r), 0);
  });
  test("depois de uma desistência, a repetição pontua (RN-07, 0,5); a seguinte, já resolvida, é treino", async () => {
    const t = await primeira();
    await desistir(t.aluno, t.id);
    const r = await refazer(t.aluno, t.id);
    assert.equal(await treino(t.aluno, r), false);
    await resolver(t.aluno, r, 50);
    assert.equal(await pdr(r), 50);
    const r3 = await refazer(t.aluno, r);
    assert.equal(await treino(t.aluno, r3), true);
  });
  test("dados_do_encerramento informa treino e se o exercício já foi resolvido", async () => {
    const t = await primeira();
    await desistir(t.aluno, t.id);
    let d = (await q("select treino, ja_resolvido from dados_do_encerramento($1, $2)", [t.aluno, t.id])).rows[0];
    assert.deepEqual(d, { treino: false, ja_resolvido: false });
    const r = await refazer(t.aluno, t.id);
    await resolver(t.aluno, r, 50);
    d = (await q("select treino, ja_resolvido from dados_do_encerramento($1, $2)", [t.aluno, r])).rows[0];
    assert.deepEqual(d, { treino: false, ja_resolvido: true });
  });
});

test("o cliente não executa as funções", async () => {
  const c = await banco.conectar();
  try {
    await c.query("set role authenticated");
    for (const sql of ["select tentativa_e_treino(gen_random_uuid())", "select * from exercicio_da_tentativa(gen_random_uuid(), gen_random_uuid())",
      "select * from dados_do_encerramento(gen_random_uuid(), gen_random_uuid())"]) {
      await assert.rejects(c.query(sql), { code: "42501" }, sql);
    }
  } finally {
    await c.end();
  }
});

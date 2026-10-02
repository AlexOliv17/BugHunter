// D-29 — testes de abrir_proximo: a RN-09 no mesmo tema e nível, sem o exercício atual.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { subirBanco } from "./banco.mjs";

let banco;
let ordem = 13000;
before(async () => { banco = await subirBanco(); });
after(async () => { await banco?.encerrar(); });

const ORIGINAL = "def f(x):\n    return x - 1";
const q = (sql, p) => banco.admin.query(sql, p);

// tema com n exercícios de nível baixo, em ordem crescente
async function cenario(n) {
  const aluno = randomUUID(), tema = "t" + randomUUID().slice(0, 8), prog = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [aluno, `${aluno}@t`, { nome: "A" }]);
  await q("insert into temas values ($1, $1, 'd', true, (select coalesce(max(ordem), 0) + 1 from temas))", [tema]);
  await q("insert into programas_base values ($1, $2, 'f', 'f(x)', 'd', 'C', '{}', 'S')", [prog, tema]);
  const exercicios = [];
  for (let i = 0; i < n; i++) {
    const id = randomUUID();
    await q(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
             values ($1, $2, 'ARIT_TROC', $3, $4, 2, '1.0.0')`, [id, prog, ordem++, ORIGINAL]);
    exercicios.push(id);
  }
  return { aluno, tema, exercicios };
}
const abrir = async (c) => (await q("select abrir_tentativa($1, $2, 'baixo') id", [c.aluno, c.tema])).rows[0].id;
const desistir = (c, t) => q("select encerrar_por_desistencia($1, $2, $3, 0)", [c.aluno, t, ORIGINAL]);
const resolver = async (c, t) => {
  await q("select registrar_localizacao($1, $2, 2)", [c.aluno, t]);
  await q("select registrar_verificar($1, $2, 'passou', 1, 1, 100, (select count(*)::int from eventos where tentativa_id = $2))", [c.aluno, t]);
};
const proximo = async (c, t) => (await q("select abrir_proximo($1, $2) id", [c.aluno, t])).rows[0].id;
const exercicioDe = async (t) => (await q("select exercicio_id, numero_tentativa from tentativas where id = $1", [t])).rows[0];

describe("abrir_proximo (D-29)", () => {
  test("depois de desistir do primeiro, vai para o segundo, não volta ao mesmo", async () => {
    const c = await cenario(3);
    const t = await abrir(c);
    await desistir(c, t);
    assert.deepEqual(await exercicioDe(await proximo(c, t)), { exercicio_id: c.exercicios[1], numero_tentativa: 1 });
  });
  test("pula os resolvidos: vai ao não resolvido de menor ordem", async () => {
    const c = await cenario(3);
    const t1 = await abrir(c);
    await resolver(c, t1);
    const t2 = await proximo(c, t1);
    await resolver(c, t2);
    assert.equal((await exercicioDe(await proximo(c, t2))).exercicio_id, c.exercicios[2]);
  });
  test("tentativa aberta de outro exercício do nível: retoma essa", async () => {
    const c = await cenario(3);
    const t1 = await abrir(c);
    await desistir(c, t1);
    const t2 = await proximo(c, t1);             // aberta no segundo
    assert.equal(await proximo(c, t1), t2);
  });
  test("todos resolvidos: o de menor ordem que não seja o atual, valendo metade", async () => {
    const c = await cenario(2);
    const t1 = await abrir(c);
    await resolver(c, t1);
    const t2 = await proximo(c, t1);
    await resolver(c, t2);
    assert.deepEqual(await exercicioDe(await proximo(c, t2)), { exercicio_id: c.exercicios[0], numero_tentativa: 2 });
  });
  test("nível com um exercício só: reabre o mesmo", async () => {
    const c = await cenario(1);
    const t = await abrir(c);
    await desistir(c, t);
    assert.deepEqual(await exercicioDe(await proximo(c, t)), { exercicio_id: c.exercicios[0], numero_tentativa: 2 });
  });
  test("exercício desativado não é escolhido (D-21)", async () => {
    const c = await cenario(3);
    await q("update exercicios set ativo = false where id = $1", [c.exercicios[1]]);
    const t = await abrir(c);
    await desistir(c, t);
    assert.equal((await exercicioDe(await proximo(c, t))).exercicio_id, c.exercicios[2]);
  });
  test("tentativa aberta ou de outro aluno: recusa", async () => {
    const c = await cenario(2);
    const t = await abrir(c);
    await assert.rejects(proximo(c, t), { code: "BH011" });
    await assert.rejects(q("select abrir_proximo($1, $2)", [randomUUID(), t]), { code: "BH001" });
  });
});

test("o cliente não executa a função", async () => {
  const c = await banco.conectar();
  try {
    await c.query("set role authenticated");
    await assert.rejects(c.query("select abrir_proximo(gen_random_uuid(), gen_random_uuid())"), { code: "42501" });
  } finally {
    await c.end();
  }
});

// S5-07 — testes de refazer_exercicio (RF-16, RN-07, RN-11).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { subirBanco } from "./banco.mjs";

let banco;
let ordem = 12000;
before(async () => { banco = await subirBanco(); });
after(async () => { await banco?.encerrar(); });

const ORIGINAL = "def f(x):\n    return x - 1";

async function encerrada() {
  const q = (sql, p) => banco.admin.query(sql, p);
  const aluno = randomUUID(), tema = "t" + randomUUID().slice(0, 8), prog = randomUUID(), exercicio = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [aluno, `${aluno}@t`, { nome: "A" }]);
  await q("insert into temas values ($1, $1, 'd', true, (select coalesce(max(ordem), 0) + 1 from temas))", [tema]);
  await q("insert into programas_base values ($1, $2, 'f', 'f(x)', 'd', 'C', '{}', 'S')", [prog, tema]);
  await q(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
           values ($1, $2, 'ARIT_TROC', $3, $4, 2, '1.0.0')`, [exercicio, prog, ordem++, ORIGINAL]);
  const id = (await q("select abrir_tentativa($1, $2, 'baixo') id", [aluno, tema])).rows[0].id;
  await q("select encerrar_por_desistencia($1, $2, $3, 0)", [aluno, id, ORIGINAL]);
  return { aluno, id, exercicio };
}

const refazer = async (aluno, tentativa) =>
  (await banco.admin.query("select refazer_exercicio($1, $2) id", [aluno, tentativa])).rows[0].id;
const linha = async (id) =>
  (await banco.admin.query("select exercicio_id, numero_tentativa, desfecho from tentativas where id = $1", [id])).rows[0];

describe("refazer_exercicio (RF-16)", () => {
  test("abre outra tentativa do mesmo exercício, com o número incrementado", async () => {
    const t = await encerrada();
    const nova = await refazer(t.aluno, t.id);
    assert.notEqual(nova, t.id);
    assert.deepEqual(await linha(nova), { exercicio_id: t.exercicio, numero_tentativa: 2, desfecho: "aberto" });
  });
  test("já existe uma aberta do exercício: devolve a mesma (RN-10)", async () => {
    const t = await encerrada();
    const nova = await refazer(t.aluno, t.id);
    assert.equal(await refazer(t.aluno, t.id), nova);
  });
  test("terceira vez: número 3", async () => {
    const t = await encerrada();
    const segunda = await refazer(t.aluno, t.id);
    await banco.admin.query("select encerrar_por_desistencia($1, $2, $3, 0)", [t.aluno, segunda, ORIGINAL]);
    assert.equal((await linha(await refazer(t.aluno, segunda))).numero_tentativa, 3);
  });
  test("tentativa aberta ou de outro aluno: recusa", async () => {
    const t = await encerrada();
    const aberta = await refazer(t.aluno, t.id);
    await assert.rejects(refazer(t.aluno, aberta), { code: "BH011" });
    await assert.rejects(refazer(randomUUID(), t.id), { code: "BH001" });
  });
  test("pedidos simultâneos: uma tentativa só", async () => {
    const t = await encerrada();
    const conexoes = await Promise.all(Array.from({ length: 5 }, () => banco.conectar()));
    try {
      const ids = await Promise.all(conexoes.map(async (c) => (await c.query("select refazer_exercicio($1, $2) id", [t.aluno, t.id])).rows[0].id));
      assert.equal(new Set(ids).size, 1);
      const abertas = (await banco.admin.query("select count(*)::int n from tentativas where exercicio_id = $1 and desfecho = 'aberto'", [t.exercicio])).rows[0].n;
      assert.equal(abertas, 1);
    } finally {
      await Promise.all(conexoes.map((c) => c.end()));
    }
  });
});

test("o cliente não executa a função", async () => {
  const c = await banco.conectar();
  try {
    await c.query("set role authenticated");
    await assert.rejects(c.query("select refazer_exercicio(gen_random_uuid(), gen_random_uuid())"), { code: "42501" });
  } finally {
    await c.end();
  }
});

// S3-03 — testes de registrar_localizacao (RF-07, RN-01), num Postgres 17 real.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { subirBanco } from "./banco.mjs";

let banco;
let ordem = 5000;
before(async () => { banco = await subirBanco(); });
after(async () => { await banco?.encerrar(); });

const CODIGO = "def f(x):\n    y = x\n    return y - 1";   // 3 linhas; defeito na linha 3

async function tentativaAberta({ linhaDefeito = 3 } = {}) {
  const q = (sql, p) => banco.admin.query(sql, p);
  const aluno = randomUUID(), tema = "t" + randomUUID().slice(0, 8), prog = randomUUID(), ex = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [aluno, `${aluno}@t`, { nome: "A" }]);
  await q("insert into temas values ($1, $1, 'd', true, (select coalesce(max(ordem), 0) + 1 from temas))", [tema]);
  await q("insert into programas_base values ($1, $2, 'f', 'f(x)', 'd', 'C', '{}', 'S')", [prog, tema]);
  await q(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
           values ($1, $2, 'ARIT_TROC', $3, $4, $5, '1.0.0')`, [ex, prog, ordem++, CODIGO, linhaDefeito]);
  const id = (await q("select abrir_tentativa($1, $2, 'baixo') id", [aluno, tema])).rows[0].id;
  return { aluno, id };
}

const localizar = async (t, linha, conexao = banco.admin) =>
  (await conexao.query("select * from registrar_localizacao($1, $2, $3)", [t.aluno, t.id, linha])).rows[0];
const eventos = async (t) =>
  (await banco.admin.query("select payload from eventos where tentativa_id = $1 and tipo = 'localizou' order by id", [t.id])).rows.map((r) => r.payload);

describe("RN-01 · resultados da localização", () => {
  test("acerto na 1ª: correta e concluída", async () => {
    const t = await tentativaAberta();
    assert.deepEqual(await localizar(t, 3), { correta: true, tentativa_num: 1, concluida: true });
  });

  test("erro na 1ª e acerto na 2ª", async () => {
    const t = await tentativaAberta();
    assert.deepEqual(await localizar(t, 1), { correta: false, tentativa_num: 1, concluida: false });
    assert.deepEqual(await localizar(t, 3), { correta: true, tentativa_num: 2, concluida: true });
  });

  test("erro nas duas: a segunda conclui a localização (destravamento automático)", async () => {
    const t = await tentativaAberta();
    await localizar(t, 1);
    assert.deepEqual(await localizar(t, 2), { correta: false, tentativa_num: 2, concluida: true });
  });

  test("grava um evento localizou por clique, com linha, acerto e número (RF-07)", async () => {
    const t = await tentativaAberta();
    await localizar(t, 2);
    await localizar(t, 3);
    assert.deepEqual(await eventos(t), [
      { linha: 2, correta: false, tentativa_num: 1 },
      { linha: 3, correta: true, tentativa_num: 2 },
    ]);
  });
});

describe("RN-01 · recusas", () => {
  test("não há terceira tentativa", async () => {
    const t = await tentativaAberta();
    await localizar(t, 1);
    await localizar(t, 2);
    await assert.rejects(localizar(t, 3), { code: "BH003" });
    assert.equal((await eventos(t)).length, 2);
  });

  test("depois de acertar não se aponta de novo", async () => {
    const t = await tentativaAberta();
    await localizar(t, 3);
    await assert.rejects(localizar(t, 1), { code: "BH003" });
  });

  test("linha fora do código não conta como tentativa", async () => {
    const t = await tentativaAberta();
    await assert.rejects(localizar(t, 0), { code: "BH004" });
    await assert.rejects(localizar(t, 4), { code: "BH004" });
    assert.equal((await eventos(t)).length, 0);
  });

  test("tentativa de outro aluno não é encontrada", async () => {
    const t = await tentativaAberta();
    await assert.rejects(localizar({ ...t, aluno: randomUUID() }, 3), { code: "BH001" });
  });

  test("tentativa encerrada é recusada", async () => {
    const t = await tentativaAberta();
    await banco.admin.query("update tentativas set desfecho = 'desistiu', fechada_em = now(), pdr_final = 0 where id = $1", [t.id]);
    await assert.rejects(localizar(t, 3), { code: "BH002" });
  });

  test("cliques simultâneos gravam no máximo duas tentativas", async () => {
    const t = await tentativaAberta();
    const conexoes = await Promise.all(Array.from({ length: 5 }, () => banco.conectar()));
    try {
      const r = await Promise.allSettled(conexoes.map((c) => localizar(t, 1, c)));
      assert.equal(r.filter((x) => x.status === "fulfilled").length, 2);
      assert.ok(r.filter((x) => x.status === "rejected").every((x) => x.reason.code === "BH003"));
      assert.deepEqual((await eventos(t)).map((e) => e.tentativa_num), [1, 2]);
    } finally {
      await Promise.all(conexoes.map((c) => c.end()));
    }
  });
});

test("o cliente não executa a função", async () => {
  const c = await banco.conectar();
  try {
    await c.query("set role authenticated");
    await assert.rejects(c.query("select * from registrar_localizacao(gen_random_uuid(), gen_random_uuid(), 1)"), { code: "42501" });
  } finally {
    await c.end();
  }
});

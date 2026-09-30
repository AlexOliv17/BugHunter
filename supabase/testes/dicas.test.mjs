// S4-05 — testes de solicitar_dica e dicas_da_tentativa (RF-12, RN-04).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { subirBanco } from "./banco.mjs";

let banco;
let ordem = 10000;
before(async () => {
  banco = await subirBanco();
  for (const n of [1, 2, 3]) {
    await banco.admin.query("insert into dicas values ('ARIT_TROC', $1, $2)", [n, `texto da dica ${n}`]);
  }
});
after(async () => { await banco?.encerrar(); });

async function tentativa({ destravada = true } = {}) {
  const q = (sql, p) => banco.admin.query(sql, p);
  const aluno = randomUUID(), tema = "t" + randomUUID().slice(0, 8), prog = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [aluno, `${aluno}@t`, { nome: "A" }]);
  await q("insert into temas values ($1, $1, 'd', true, (select coalesce(max(ordem), 0) + 1 from temas))", [tema]);
  await q("insert into programas_base values ($1, $2, 'f', 'f(x)', 'd', 'C', '{}', 'S')", [prog, tema]);
  await q(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
           values (gen_random_uuid(), $1, 'ARIT_TROC', $2, 'def f(x):\n    return x - 1', 2, '1.0.0')`, [prog, ordem++]);
  const id = (await q("select abrir_tentativa($1, $2, 'baixo') id", [aluno, tema])).rows[0].id;
  if (destravada) await q("select registrar_localizacao($1, $2, 2)", [aluno, id]);
  return { aluno, id };
}

const pedir = async (t, nivel) => (await banco.admin.query("select solicitar_dica($1, $2, $3) texto", [t.aluno, t.id, nivel])).rows[0].texto;
const falhar = (t) => banco.admin.query(
  "select registrar_verificar($1, $2, 'falhou', 0, 1, null, (select count(*)::int from eventos where tentativa_id = $2))", [t.aluno, t.id]);
const eventosDica = async (t) =>
  (await banco.admin.query("select payload from eventos where tentativa_id = $1 and tipo = 'dica' order by id", [t.id])).rows.map((r) => r.payload);

describe("solicitar_dica (RN-04)", () => {
  test("editor travado: nenhuma dica", async () => {
    const t = await tentativa({ destravada: false });
    for (const n of [1, 2, 3]) await assert.rejects(pedir(t, n), { code: "BH009" }, `dica ${n}`);
  });
  test("destravado: dica 1 sai e grava o evento; 2 e 3 ainda não", async () => {
    const t = await tentativa();
    await assert.rejects(pedir(t, 2), { code: "BH009" });
    assert.equal(await pedir(t, 1), "texto da dica 1");
    assert.deepEqual(await eventosDica(t), [{ nivel: 1 }]);
    await assert.rejects(pedir(t, 2), { code: "BH009" }, "sem Verificar falho");
    await assert.rejects(pedir(t, 3), { code: "BH009" }, "sem a dica 2");
  });
  test("Verificar falho sem a dica 1 não libera a 2", async () => {
    const t = await tentativa();
    await falhar(t);
    await assert.rejects(pedir(t, 2), { code: "BH009" });
  });
  test("sequência completa: 1, Verificar falho, 2, 3", async () => {
    const t = await tentativa();
    await pedir(t, 1);
    await falhar(t);
    assert.equal(await pedir(t, 2), "texto da dica 2");
    assert.equal(await pedir(t, 3), "texto da dica 3");
    assert.deepEqual(await eventosDica(t), [{ nivel: 1 }, { nivel: 2 }, { nivel: 3 }]);
  });
  test("pedir de novo uma dica usada devolve o texto sem novo evento", async () => {
    const t = await tentativa();
    await pedir(t, 1);
    assert.equal(await pedir(t, 1), "texto da dica 1");
    assert.deepEqual(await eventosDica(t), [{ nivel: 1 }]);
  });
  test("nível inválido, tentativa de outro aluno e tentativa encerrada", async () => {
    const t = await tentativa();
    await assert.rejects(pedir(t, 4), { code: "BH005" });
    await assert.rejects(banco.admin.query("select solicitar_dica($1, $2, 1)", [randomUUID(), t.id]), { code: "BH001" });
    await banco.admin.query("select registrar_verificar($1, $2, 'passou', 1, 1, 100, (select count(*)::int from eventos where tentativa_id = $2))", [t.aluno, t.id]);
    await assert.rejects(pedir(t, 1), { code: "BH002" });
  });
  test("pedidos simultâneos da dica 1: um evento só", async () => {
    const t = await tentativa();
    const conexoes = await Promise.all([banco.conectar(), banco.conectar(), banco.conectar()]);
    try {
      await Promise.all(conexoes.map((c) => c.query("select solicitar_dica($1, $2, 1)", [t.aluno, t.id])));
      assert.deepEqual(await eventosDica(t), [{ nivel: 1 }]);
    } finally {
      await Promise.all(conexoes.map((c) => c.end()));
    }
  });
});

test("dicas_da_tentativa devolve só as usadas, em ordem, e só ao dono", async () => {
  const t = await tentativa();
  await pedir(t, 1);
  await falhar(t);
  await pedir(t, 2);
  const r = (await banco.admin.query("select * from dicas_da_tentativa($1, $2)", [t.aluno, t.id])).rows;
  assert.deepEqual(r, [{ nivel: 1, texto: "texto da dica 1" }, { nivel: 2, texto: "texto da dica 2" }]);
  assert.deepEqual((await banco.admin.query("select * from dicas_da_tentativa($1, $2)", [randomUUID(), t.id])).rows, []);
});

test("o cliente não executa as funções nem lê a tabela dicas", async () => {
  const c = await banco.conectar();
  try {
    await c.query("set role authenticated");
    await assert.rejects(c.query("select solicitar_dica(gen_random_uuid(), gen_random_uuid(), 1)"), { code: "42501" });
    await assert.rejects(c.query("select * from dicas_da_tentativa(gen_random_uuid(), gen_random_uuid())"), { code: "42501" });
    await assert.rejects(c.query("select * from dicas"), { code: "42501" });
  } finally {
    await c.end();
  }
});

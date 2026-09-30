// S4-02 — testes de suite_da_tentativa e registrar_verificar (RF-10, RN-03).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { subirBanco } from "./banco.mjs";

let banco;
let ordem = 9000;
before(async () => { banco = await subirBanco(); });
after(async () => { await banco?.encerrar(); });

const SUITE = '[{"entrada": [[7, 8, 9]], "esperado": 8.0}]';

async function tentativa({ destravada = true } = {}) {
  const q = (sql, p) => banco.admin.query(sql, p);
  const aluno = randomUUID(), tema = "t" + randomUUID().slice(0, 8), prog = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [aluno, `${aluno}@t`, { nome: "A" }]);
  await q("insert into temas values ($1, $1, 'd', true, (select coalesce(max(ordem), 0) + 1 from temas))", [tema]);
  await q("insert into programas_base values ($1, $2, 'media', 'media(n)', 'd', 'C', '{}', $3)", [prog, tema, SUITE]);
  await q(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
           values (gen_random_uuid(), $1, 'ARIT_TROC', $2, 'def media(n):\n    return 0', 2, '1.0.0')`, [prog, ordem++]);
  const id = (await q("select abrir_tentativa($1, $2, 'baixo') id", [aluno, tema])).rows[0].id;
  if (destravada) await q("select registrar_localizacao($1, $2, 2)", [aluno, id]);
  return { aluno, id };
}

const contar = async (t) => Number((await banco.admin.query("select count(*) n from eventos where tentativa_id = $1", [t.id])).rows[0].n);
const verificar = async (t, resultado, passados, total, pdr = null, vistos = null) =>
  (await banco.admin.query("select registrar_verificar($1, $2, $3, $4, $5, $6, $7) encerrada",
    [t.aluno, t.id, resultado, passados, total, pdr, vistos ?? await contar(t)])).rows[0].encerrada;
const eventos = async (t) =>
  (await banco.admin.query("select tipo, payload from eventos where tentativa_id = $1 order by id", [t.id])).rows;
const linha = async (t) =>
  (await banco.admin.query("select desfecho, pdr_final, fechada_em from tentativas where id = $1", [t.id])).rows[0];

describe("suite_da_tentativa", () => {
  test("devolve a suíte como texto, com 8.0 intacto", async () => {
    const t = await tentativa();
    const r = (await banco.admin.query("select * from suite_da_tentativa($1, $2)", [t.aluno, t.id])).rows[0];
    assert.equal(r.suite_oculta, SUITE);
    assert.equal(r.nome_funcao, "media");
  });
  test("recusa editor travado, tentativa de outro aluno e tentativa encerrada", async () => {
    const travada = await tentativa({ destravada: false });
    await assert.rejects(banco.admin.query("select * from suite_da_tentativa($1, $2)", [travada.aluno, travada.id]), { code: "BH006" });
    const t = await tentativa();
    await assert.rejects(banco.admin.query("select * from suite_da_tentativa($1, $2)", [randomUUID(), t.id]), { code: "BH001" });
    await verificar(t, "passou", 1, 1, 100);
    await assert.rejects(banco.admin.query("select * from suite_da_tentativa($1, $2)", [t.aluno, t.id]), { code: "BH002" });
  });
});

describe("registrar_verificar (RF-10)", () => {
  test("sem sucesso: grava só o verificar, e a tentativa continua aberta", async () => {
    const t = await tentativa();
    assert.equal(await verificar(t, "falhou", 3, 5), false);
    assert.deepEqual((await eventos(t)).at(-1), { tipo: "verificar", payload: { resultado: "falhou", passados: 3, total: 5 } });
    assert.equal((await linha(t)).desfecho, "aberto");
  });
  test("passou: verificar, encerrou e tentativa fechada com o PDR", async () => {
    const t = await tentativa();
    assert.equal(await verificar(t, "passou", 5, 5, 117), true);
    assert.deepEqual((await eventos(t)).slice(-2), [
      { tipo: "verificar", payload: { resultado: "passou", passados: 5, total: 5 } },
      { tipo: "encerrou", payload: { desfecho: "resolvido" } },
    ]);
    const l = await linha(t);
    assert.equal(l.desfecho, "resolvido");
    assert.equal(l.pdr_final, 117);
    assert.ok(l.fechada_em);
  });
  test("depois de encerrada, nada mais é aceito", async () => {
    const t = await tentativa();
    await verificar(t, "passou", 1, 1, 100);
    await assert.rejects(verificar(t, "falhou", 0, 1), { code: "BH002" });
  });
  test("editor travado não verifica", async () => {
    const t = await tentativa({ destravada: false });
    await assert.rejects(verificar(t, "falhou", 0, 1), { code: "BH006" });
  });
  test("resultado incoerente é recusado", async () => {
    const t = await tentativa();
    for (const [r, p, tot, pdr] of [["ok", 1, 1, 1], ["passou", 4, 5, 100], ["falhou", 5, 5, null], ["falhou", 6, 5, null],
      ["passou", 1, 1, null], ["erro", -1, 5, null], ["erro", 0, 0, null]]) {
      await assert.rejects(verificar(t, r, p, tot, pdr), { code: "BH005" }, `${r} ${p}/${tot}`);
    }
  });
  test("se entrou evento depois do cálculo do PDR, nada é gravado (BH008)", async () => {
    const t = await tentativa();
    const vistos = await contar(t);
    await banco.admin.query("select registrar_edicao($1, $2, 'x', 1)", [t.aluno, t.id]);
    await assert.rejects(verificar(t, "passou", 1, 1, 100, vistos), { code: "BH008" });
    assert.equal(await contar(t), vistos + 1);
    assert.equal((await linha(t)).desfecho, "aberto");
  });
  test("dois Verificar simultâneos que passam: só um encerra", async () => {
    const t = await tentativa();
    const vistos = await contar(t);
    const conexoes = await Promise.all([banco.conectar(), banco.conectar()]);
    try {
      const r = await Promise.allSettled(conexoes.map((c) =>
        c.query("select registrar_verificar($1, $2, 'passou', 1, 1, 100, $3)", [t.aluno, t.id, vistos])));
      assert.deepEqual(r.map((x) => x.status).sort(), ["fulfilled", "rejected"]);
      assert.ok(["BH002", "BH008"].includes(r.find((x) => x.status === "rejected").reason.code));
      assert.equal((await eventos(t)).filter((e) => e.tipo === "encerrou").length, 1);
    } finally {
      await Promise.all(conexoes.map((c) => c.end()));
    }
  });
});

test("o cliente não executa as funções", async () => {
  const c = await banco.conectar();
  try {
    await c.query("set role authenticated");
    await assert.rejects(c.query("select * from suite_da_tentativa(gen_random_uuid(), gen_random_uuid())"), { code: "42501" });
    await assert.rejects(c.query("select registrar_verificar(gen_random_uuid(), gen_random_uuid(), 'passou', 1, 1, 1, 0)"), { code: "42501" });
  } finally {
    await c.end();
  }
});

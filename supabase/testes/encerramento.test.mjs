// S5-01 a S5-04 — testes de encerrar_por_desistencia, dados_do_encerramento e
// gravar_feedback (RF-13, RF-15, RN-06).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { subirBanco } from "./banco.mjs";

let banco;
let ordem = 11000;
before(async () => { banco = await subirBanco(); });
after(async () => { await banco?.encerrar(); });

const ORIGINAL = "def f(x):\n    return x - 1";

async function tentativa({ destravada = true } = {}) {
  const q = (sql, p) => banco.admin.query(sql, p);
  const aluno = randomUUID(), tema = "t" + randomUUID().slice(0, 8), prog = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [aluno, `${aluno}@t`, { nome: "A" }]);
  await q("insert into temas values ($1, $1, 'd', true, (select coalesce(max(ordem), 0) + 1 from temas))", [tema]);
  await q("insert into programas_base values ($1, $2, 'f', 'f(x)', 'd', 'CORRETO', '{}', 'S')", [prog, tema]);
  await q(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
           values (gen_random_uuid(), $1, 'ARIT_TROC', $2, $3, 2, '1.0.0')`, [prog, ordem++, ORIGINAL]);
  const id = (await q("select abrir_tentativa($1, $2, 'baixo') id", [aluno, tema])).rows[0].id;
  if (destravada) await q("select registrar_localizacao($1, $2, 2)", [aluno, id]);
  return { aluno, id };
}

const desistir = (t, codigo = ORIGINAL, linhas = 0) =>
  banco.admin.query("select encerrar_por_desistencia($1, $2, $3, $4)", [t.aluno, t.id, codigo, linhas]);
const dados = async (t, usuario = t.aluno) =>
  (await banco.admin.query("select * from dados_do_encerramento($1, $2)", [usuario, t.id])).rows[0];
const ultimos = async (t, n) =>
  (await banco.admin.query("select tipo, payload from eventos where tentativa_id = $1 order by id desc limit $2", [t.id, n])).rows.reverse();

describe("encerrar_por_desistencia (RF-13, RN-06)", () => {
  test("grava editou e encerrou; fecha com PDR 0", async () => {
    const t = await tentativa();
    await desistir(t, "def f(x):\n    return x + 1", 1);
    assert.deepEqual(await ultimos(t, 2), [
      { tipo: "editou", payload: { codigo: "def f(x):\n    return x + 1", linhas_alteradas: 1 } },
      { tipo: "encerrou", payload: { desfecho: "desistiu" } },
    ]);
    const l = (await banco.admin.query("select desfecho, pdr_final, fechada_em from tentativas where id = $1", [t.id])).rows[0];
    assert.equal(l.desfecho, "desistiu");
    assert.equal(l.pdr_final, 0);
    assert.ok(l.fechada_em);
  });
  test("vale com o editor travado (D-17), com o código recebido", async () => {
    const t = await tentativa({ destravada: false });
    await assert.rejects(desistir(t, "outro código"), { code: "BH006" });
    await desistir(t);
    assert.equal((await dados(t)).desfecho, "desistiu");
  });
  test("irreversível: depois de encerrada, nada mais", async () => {
    const t = await tentativa();
    await desistir(t);
    await assert.rejects(desistir(t), { code: "BH002" });
    await assert.rejects(banco.admin.query("select registrar_edicao($1, $2, 'x', 0)", [t.aluno, t.id]), { code: "BH002" });
  });
  test("tentativa de outro aluno", async () => {
    const t = await tentativa();
    await assert.rejects(desistir({ ...t, aluno: randomUUID() }), { code: "BH001" });
  });
});

describe("dados_do_encerramento (RF-15, RNF-03)", () => {
  test("aberta: recusa, nada de gabarito", async () => {
    const t = await tentativa();
    await assert.rejects(dados(t), { code: "BH011" });
  });
  test("encerrada: devolve gabarito e categoria ao dono", async () => {
    const t = await tentativa();
    await desistir(t);
    const d = await dados(t);
    assert.equal(d.codigo_correto, "CORRETO");
    assert.equal(d.linha_defeito, 2);
    assert.equal(d.categoria_nome, "operador aritmético trocado");
    assert.ok(d.categoria_descricao.length > 10);
    assert.equal(d.pdr_final, 0);
  });
  test("de outro aluno: recusa", async () => {
    const t = await tentativa();
    await desistir(t);
    await assert.rejects(dados(t, randomUUID()), { code: "BH001" });
  });
});

describe("gravar_feedback (RF-15)", () => {
  test("grava uma vez; a segunda não substitui", async () => {
    const t = await tentativa();
    await desistir(t);
    const g = async (texto) => (await banco.admin.query("select gravar_feedback($1, $2) t", [t.id, texto])).rows[0].t;
    assert.equal(await g("primeiro"), "primeiro");
    assert.equal(await g("segundo"), "primeiro");
    assert.equal((await dados(t)).feedback_texto, "primeiro");
  });
  test("tentativa aberta não recebe feedback", async () => {
    const t = await tentativa();
    await assert.rejects(banco.admin.query("select gravar_feedback($1, 'x')", [t.id]), { code: "BH011" });
  });
});

test("o cliente não executa as funções", async () => {
  const c = await banco.conectar();
  try {
    await c.query("set role authenticated");
    for (const sql of [
      "select encerrar_por_desistencia(gen_random_uuid(), gen_random_uuid(), 'x', 0)",
      "select * from dados_do_encerramento(gen_random_uuid(), gen_random_uuid())",
      "select gravar_feedback(gen_random_uuid(), 'x')",
    ]) await assert.rejects(c.query(sql), { code: "42501" }, sql);
  } finally {
    await c.end();
  }
});

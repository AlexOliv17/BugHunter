// S3-07 — testes de registrar_edicao e registrar_precheck (RF-08, RF-09, RN-02, RN-12).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { subirBanco } from "./banco.mjs";

let banco;
let ordem = 8000;
before(async () => { banco = await subirBanco(); });
after(async () => { await banco?.encerrar(); });

const CODIGO = "def f(x):\n    return x - 1";

async function tentativa({ destravada = true } = {}) {
  const q = (sql, p) => banco.admin.query(sql, p);
  const aluno = randomUUID(), tema = "t" + randomUUID().slice(0, 8), prog = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [aluno, `${aluno}@t`, { nome: "A" }]);
  await q("insert into temas values ($1, $1, 'd', true, (select coalesce(max(ordem), 0) + 1 from temas))", [tema]);
  await q("insert into programas_base values ($1, $2, 'f', 'f(x)', 'd', 'C', '{}', 'S')", [prog, tema]);
  await q(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
           values (gen_random_uuid(), $1, 'ARIT_TROC', $2, $3, 2, '1.0.0')`, [prog, ordem++, CODIGO]);
  const id = (await q("select abrir_tentativa($1, $2, 'baixo') id", [aluno, tema])).rows[0].id;
  if (destravada) await q("select registrar_localizacao($1, $2, 2)", [aluno, id]);
  return { aluno, id };
}

const editar = (t, codigo, linhas = 1) => banco.admin.query("select registrar_edicao($1, $2, $3, $4)", [t.aluno, t.id, codigo, linhas]);
const precheck = async (t, resultado = "falhou", obtido = "3") =>
  (await banco.admin.query("select registrar_precheck($1, $2, $3, $4) n", [t.aluno, t.id, resultado, obtido])).rows[0].n;
const eventos = async (t, tipo) =>
  (await banco.admin.query("select payload from eventos where tentativa_id = $1 and tipo = $2 order by id", [t.id, tipo])).rows.map((r) => r.payload);

describe("editou (RF-08, RN-12)", () => {
  test("grava {codigo, linhas_alteradas}", async () => {
    const t = await tentativa();
    await editar(t, "def f(x):\n    return x + 1", 1);
    assert.deepEqual(await eventos(t, "editou"), [{ codigo: "def f(x):\n    return x + 1", linhas_alteradas: 1 }]);
  });

  test("com o editor travado, só o código recebido é aceito", async () => {
    const t = await tentativa({ destravada: false });
    await assert.rejects(editar(t, "def f(x):\n    return x + 1"), { code: "BH006" });
    await editar(t, CODIGO, 0);   // desistir antes de localizar grava o código original (D-17)
    assert.equal((await eventos(t, "editou")).length, 1);
  });

  test("tentativa encerrada ou de outro aluno é recusada", async () => {
    const t = await tentativa();
    await assert.rejects(editar({ ...t, aluno: randomUUID() }, CODIGO), { code: "BH001" });
    await banco.admin.query("update tentativas set desfecho = 'desistiu', fechada_em = now(), pdr_final = 0 where id = $1", [t.id]);
    await assert.rejects(editar(t, CODIGO), { code: "BH002" });
  });

  test("contagem negativa é recusada", async () => {
    const t = await tentativa();
    await assert.rejects(editar(t, CODIGO, -1), { code: "BH005" });
  });
});

describe("precheck (RF-09, RN-02)", () => {
  test("numera os usos no servidor e grava {resultado, obtido, numero_uso}", async () => {
    const t = await tentativa();
    assert.equal(await precheck(t, "falhou", "3"), 1);
    assert.equal(await precheck(t, "tempo_excedido", null), 2);
    assert.deepEqual(await eventos(t, "precheck"), [
      { resultado: "falhou", obtido: "3", numero_uso: 1 },
      { resultado: "tempo_excedido", obtido: null, numero_uso: 2 },
    ]);
  });

  test("recusa o quarto uso", async () => {
    const t = await tentativa();
    for (let i = 0; i < 3; i++) await precheck(t);
    await assert.rejects(precheck(t), { code: "BH007" });
    assert.equal((await eventos(t, "precheck")).length, 3);
  });

  test("recusa com o editor travado", async () => {
    const t = await tentativa({ destravada: false });
    await assert.rejects(precheck(t), { code: "BH006" });
  });

  test("recusa resultado fora da lista", async () => {
    const t = await tentativa();
    await assert.rejects(precheck(t, "aprovado"), { code: "BH005" });
  });

  test("cinco envios simultâneos gravam no máximo 3", async () => {
    const t = await tentativa();
    const conexoes = await Promise.all(Array.from({ length: 5 }, () => banco.conectar()));
    try {
      await Promise.allSettled(conexoes.map((c) => c.query("select registrar_precheck($1, $2, 'passou', '1')", [t.aluno, t.id])));
      assert.deepEqual((await eventos(t, "precheck")).map((e) => e.numero_uso), [1, 2, 3]);
    } finally {
      await Promise.all(conexoes.map((c) => c.end()));
    }
  });
});

test("o cliente não executa as funções", async () => {
  const c = await banco.conectar();
  try {
    await c.query("set role authenticated");
    await assert.rejects(c.query("select registrar_edicao(gen_random_uuid(), gen_random_uuid(), 'x', 0)"), { code: "42501" });
    await assert.rejects(c.query("select registrar_precheck(gen_random_uuid(), gen_random_uuid(), 'passou', 'x')"), { code: "42501" });
  } finally {
    await c.end();
  }
});

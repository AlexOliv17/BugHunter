// S2-07 — testes de abrir_tentativa (RF-05): as três situações da RN-09 e a RN-11
// sob requisições simultâneas, num Postgres 17 real (várias conexões ao mesmo tempo).
// Rodar em supabase/testes: npm test

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { subirBanco } from "./banco.mjs";

let banco;
let proximaOrdem = 1000;

before(async () => { banco = await subirBanco(); });
after(async () => { await banco?.encerrar(); });

// Cria um aluno e um programa-base com exercícios no nível pedido. Cada teste usa
// o seu próprio tema, para não enxergar os exercícios dos outros.
async function cenario({ nivel = "baixo", exercicios = 3 } = {}) {
  const q = (sql, params) => banco.admin.query(sql, params);
  const aluno = randomUUID();
  const tema = "t" + randomUUID().slice(0, 8);
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [aluno, `${aluno}@teste`, { nome: "Aluno Teste" }]);
  const ordem = await q("select coalesce(max(ordem), 0) + 1 as o from temas");
  await q("insert into temas (codigo, nome, descricao, ativo, ordem) values ($1, $1, 'd', true, $2)", [tema, ordem.rows[0].o]);
  const programa = randomUUID();
  await q("insert into programas_base values ($1, $2, 'f', 'f(x)', 'd', 'CORRETO', '{}', 'SUITE')", [programa, tema]);
  const categoria = nivel === "baixo" ? "CMP_INV" : "LACO_DESL";
  const ids = [];
  for (let i = 0; i < exercicios; i++) {
    const id = randomUUID();
    ids.push(id);
    await q(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
             values ($1, $2, $3, $4, 'c', 1, '1.0.0')`, [id, programa, categoria, proximaOrdem++]);
  }
  return { aluno, tema, nivel, exercicios: ids }; // ids em ordem crescente de `ordem`
}

async function abrir(c, conexao = banco.admin) {
  const r = await conexao.query("select abrir_tentativa($1, $2, $3) as id", [c.aluno, c.tema, c.nivel]);
  return r.rows[0].id;
}

const tentativa = async (id) => (await banco.admin.query("select * from tentativas where id = $1", [id])).rows[0];
const tentativasDo = async (aluno) => (await banco.admin.query("select * from tentativas where usuario_id = $1 order by iniciada_em", [aluno])).rows;
const encerrar = (id, desfecho) => banco.admin.query(
  "update tentativas set desfecho = $2, fechada_em = now(), pdr_final = $3 where id = $1", [id, desfecho, desfecho === "resolvido" ? 100 : 0]);

describe("RN-09 · situação 1: há tentativa aberta no tema e nível", () => {
  test("retoma a aberta, sem criar nova (RN-10)", async () => {
    const c = await cenario();
    const primeira = await abrir(c);
    assert.equal(await abrir(c), primeira);
    assert.equal((await tentativasDo(c.aluno)).length, 1);
  });

  test("retoma a aberta mesmo existindo não resolvido de ordem menor", async () => {
    const c = await cenario();
    const t = await abrir(c);                                   // exercício 0
    await encerrar(t, "resolvido");
    const segunda = await abrir(c);                             // exercício 1
    await banco.admin.query("update exercicios set ordem = ordem + 50000 where id = $1", [c.exercicios[1]]);
    assert.equal(await abrir(c), segunda);
  });

  test("retoma a aberta mesmo que o exercício tenha sido desativado (D-21)", async () => {
    const c = await cenario();
    const t = await abrir(c);
    await banco.admin.query("update exercicios set ativo = false where id = $1", [(await tentativa(t)).exercicio_id]);
    assert.equal(await abrir(c), t);
  });

  test("a aberta em outro nível não é retomada", async () => {
    const baixo = await cenario({ nivel: "baixo" });
    const tBaixo = await abrir(baixo);
    const medio = { ...baixo, nivel: "medio" };
    const programa = (await banco.admin.query("select programa_base_id from exercicios where id = $1", [baixo.exercicios[0]])).rows[0].programa_base_id;
    const exMedio = randomUUID();
    await banco.admin.query(`insert into exercicios (id, programa_base_id, categoria_codigo, ordem, codigo_com_defeito, linha_defeito, mutador_versao)
                             values ($1, $2, 'LACO_DESL', $3, 'c', 1, '1.0.0')`, [exMedio, programa, proximaOrdem++]);
    const tMedio = await abrir(medio);
    assert.notEqual(tMedio, tBaixo);
    assert.equal((await tentativa(tMedio)).exercicio_id, exMedio);
  });
});

describe("RN-09 · situação 2: sem aberta, há não resolvidos", () => {
  test("abre o não resolvido de menor ordem", async () => {
    const c = await cenario();
    assert.equal((await tentativa(await abrir(c))).exercicio_id, c.exercicios[0]);
  });

  test("pula os resolvidos, na ordem", async () => {
    const c = await cenario();
    await encerrar(await abrir(c), "resolvido");
    assert.equal((await tentativa(await abrir(c))).exercicio_id, c.exercicios[1]);
  });

  test("desistência não conta como resolvido: o exercício volta, com tentativa 2 (RN-07)", async () => {
    const c = await cenario();
    await encerrar(await abrir(c), "desistiu");
    const t = await tentativa(await abrir(c));
    assert.equal(t.exercicio_id, c.exercicios[0]);
    assert.equal(t.numero_tentativa, 2);
  });

  test("exercício inativo não é escolhido (D-21)", async () => {
    const c = await cenario();
    await banco.admin.query("update exercicios set ativo = false where id = $1", [c.exercicios[0]]);
    assert.equal((await tentativa(await abrir(c))).exercicio_id, c.exercicios[1]);
  });
});

describe("RN-09 · situação 3: sem aberta, todos resolvidos", () => {
  test("abre o de menor ordem, com numero_tentativa 2 (multiplicador 0,5 — RF-05)", async () => {
    const c = await cenario({ exercicios: 2 });
    await encerrar(await abrir(c), "resolvido");
    await encerrar(await abrir(c), "resolvido");
    const t = await tentativa(await abrir(c));
    assert.equal(t.exercicio_id, c.exercicios[0]);
    assert.equal(t.numero_tentativa, 2);
  });

  test("nível sem nenhum exercício ativo dá erro, sem criar tentativa", async () => {
    const c = await cenario({ exercicios: 1 });
    await banco.admin.query("update exercicios set ativo = false where id = $1", [c.exercicios[0]]);
    await assert.rejects(abrir(c), /não há exercícios/);
    assert.equal((await tentativasDo(c.aluno)).length, 0);
  });
});

describe("RN-11 · numeração das tentativas", () => {
  test("maior existente mais um, por par aluno-exercício", async () => {
    const c = await cenario({ exercicios: 1 });
    const numeros = [];
    for (let i = 0; i < 4; i++) {
      const t = await abrir(c);
      numeros.push((await tentativa(t)).numero_tentativa);
      await encerrar(t, i % 2 ? "desistiu" : "resolvido");
    }
    assert.deepEqual(numeros, [1, 2, 3, 4]);
  });

  test("a numeração de um aluno não afeta a de outro", async () => {
    const c = await cenario({ exercicios: 1 });
    await encerrar(await abrir(c), "resolvido");
    const outro = randomUUID();
    await banco.admin.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [outro, `${outro}@teste`, { nome: "Outro" }]);
    const t = await tentativa(await abrir({ ...c, aluno: outro }));
    assert.equal(t.numero_tentativa, 1);
  });

  test("requisições simultâneas criam uma única tentativa (RF-05, critério 5)", async () => {
    const c = await cenario();
    const conexoes = await Promise.all(Array.from({ length: 10 }, () => banco.conectar()));
    try {
      const ids = await Promise.all(conexoes.map((conexao) => abrir(c, conexao)));
      assert.equal(new Set(ids).size, 1, "todas as requisições devolvem a mesma tentativa");
      const linhas = await tentativasDo(c.aluno);
      assert.equal(linhas.length, 1);
      assert.equal(linhas[0].numero_tentativa, 1);
    } finally {
      await Promise.all(conexoes.map((conexao) => conexao.end()));
    }
  });

  test("requisições simultâneas depois de encerrar criam só a tentativa seguinte", async () => {
    const c = await cenario({ exercicios: 1 });
    await encerrar(await abrir(c), "resolvido");
    const conexoes = await Promise.all(Array.from({ length: 10 }, () => banco.conectar()));
    try {
      const ids = await Promise.all(conexoes.map((conexao) => abrir(c, conexao)));
      assert.equal(new Set(ids).size, 1);
      assert.deepEqual((await tentativasDo(c.aluno)).map((t) => t.numero_tentativa), [1, 2]);
    } finally {
      await Promise.all(conexoes.map((conexao) => conexao.end()));
    }
  });
});

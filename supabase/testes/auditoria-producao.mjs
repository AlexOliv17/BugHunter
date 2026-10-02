// Auditoria do banco publicado (S3-08, repetida na S6-02; RNF-03, RNF-04).
//
//   node supabase/testes/auditoria-producao.mjs
//
// 1. Pelo catálogo (somente leitura, numa transação read only): o que os papéis anon
//    e authenticated podem fazer em cada tabela, coluna e função. Precisa de
//    SUPABASE_DB_URL no .env da raiz.
// 2. Pela API REST com a chave pública (a mesma que o navegador recebe): tentativas
//    reais de ler as tabelas protegidas e de chamar as funções do servidor. Precisa
//    de NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em app/.env.local.
// Imprime só nomes, códigos HTTP e contagens; nenhum valor de credencial.

import { readFileSync } from "node:fs";
import pg from "pg";

const RAIZ = new URL("../../", import.meta.url);
const ler = (arquivo, chave) => readFileSync(new URL(arquivo, RAIZ), "utf8").match(new RegExp(`^${chave}=["']?([^"'\\r\\n]+)`, "m"))?.[1];

const ESPERADO = {
  anon: { tabelas: {}, editaveis: [], funcoes: [] },
  authenticated: {
    tabelas: { temas_publicos: ["SELECT"], usuarios: ["SELECT"] },
    editaveis: ["usuarios.nome"],
    funcoes: ["niveis_do_tema(text)", "progresso_por_tema()"],
  },
};
const SEGREDOS = ["suite_oculta", "codigo_correto", "linha_defeito", "categoria_codigo"];
const PRIVILEGIOS = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
let alertas = 0;
const linha = (ok, texto) => { if (!ok) alertas++; console.log(`${ok ? "ok    " : "ALERTA"}  ${texto}`); };

// ─────────────────────────── 1. catálogo ───────────────────────────
const c = new pg.Client({ connectionString: ler(".env", "SUPABASE_DB_URL"), ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin read only");
const tabelas = (await c.query(
  "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','v','m','p') order by 1")).rows.map((r) => r.relname);
console.log(`catálogo: ${tabelas.length} tabelas e views em public`);
for (const papel of ["anon", "authenticated"]) {
  const obtido = {};
  for (const t of tabelas) for (const p of PRIVILEGIOS) {
    if ((await c.query("select has_table_privilege($1, $2, $3) ok", [papel, `public.${t}`, p])).rows[0].ok) (obtido[t] ??= []).push(p);
  }
  linha(JSON.stringify(obtido) === JSON.stringify(ESPERADO[papel].tabelas), `${papel}: tabelas ${JSON.stringify(obtido)}`);
  const colunas = (await c.query(`select table_name t, column_name col,
      has_column_privilege($1, 'public.' || table_name, column_name, 'SELECT') le,
      has_column_privilege($1, 'public.' || table_name, column_name, 'UPDATE') edita
    from information_schema.columns where table_schema = 'public'`, [papel])).rows;
  const legiveis = colunas.filter((r) => SEGREDOS.includes(r.col) && r.le).map((r) => `${r.t}.${r.col}`);
  linha(legiveis.length === 0, `${papel}: colunas secretas legíveis ${JSON.stringify(legiveis)}`);
  const editaveis = colunas.filter((r) => r.edita).map((r) => `${r.t}.${r.col}`);
  linha(JSON.stringify(editaveis) === JSON.stringify(ESPERADO[papel].editaveis), `${papel}: colunas editáveis ${JSON.stringify(editaveis)}`);
  const funcoes = (await c.query(`select p.oid::regprocedure::text a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype and has_function_privilege($1, p.oid, 'EXECUTE') order by 1`, [papel])).rows.map((r) => r.a);
  linha(JSON.stringify(funcoes) === JSON.stringify(ESPERADO[papel].funcoes), `${papel}: funções ${JSON.stringify(funcoes)}`);
}
const semRls = (await c.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('usuarios', 'tentativas', 'eventos') and not c.relrowsecurity`)).rows.map((r) => r.relname);
linha(semRls.length === 0, `RLS ligado em usuarios, tentativas e eventos (sem RLS: ${JSON.stringify(semRls)})`);
const funcoesServidor = (await c.query(`select p.proname, coalesce(p.proargnames, '{}') argumentos, p.proargtypes::regtype[]::text[] tipos
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype and p.proname not in ('niveis_do_tema', 'progresso_por_tema') order by 1`)).rows;
await c.query("rollback");
await c.end();

// ───────────────────── 2. REST com a chave pública ─────────────────────
const url = ler("app/.env.local", "NEXT_PUBLIC_SUPABASE_URL")?.replace(/\/$/, "");
const chave = ler("app/.env.local", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
const rest = (caminho, init = {}) => fetch(`${url}/rest/v1/${caminho}`, {
  ...init, headers: { apikey: chave, "content-type": "application/json", ...(init.headers ?? {}) },
}).then(async (r) => ({ status: r.status, corpo: await r.text() }));

console.log("\nREST com a chave pública, sem login:");
for (const t of ["exercicios", "programas_base", "dicas", "tentativas", "eventos", "usuarios", "categorias_defeito", "temas", "temas_publicos"]) {
  const r = await rest(`${t}?select=*&limit=1`);
  // negado: erro de permissão; ou 200 com lista vazia (nenhuma linha visível)
  const vazio = r.status === 200 && r.corpo.trim() === "[]";
  linha(r.status >= 400 || vazio, `ler ${t}: HTTP ${r.status}${vazio ? " (lista vazia)" : ""}`);
}
for (const t of ["eventos", "tentativas"]) {
  const r = await rest(t, { method: "POST", body: JSON.stringify({}) });
  linha(r.status >= 400, `escrever em ${t}: HTTP ${r.status}`);
}
// com os nomes reais dos parâmetros, para a API achar a função e decidir pela permissão
const exemplo = { uuid: "00000000-0000-0000-0000-000000000000", text: "x", integer: 1 };
for (const f of funcoesServidor) {
  const corpo = Object.fromEntries(f.argumentos.slice(0, f.tipos.length).map((nome, i) => [nome, exemplo[f.tipos[i]] ?? null]));
  const r = await rest(`rpc/${f.proname}`, { method: "POST", body: JSON.stringify(corpo) });
  const negado = r.status === 401 || r.status === 403 || /42501|permission denied/.test(r.corpo);
  linha(negado, `chamar ${f.proname}: HTTP ${r.status}${negado ? " (sem permissão)" : ""}`);
}

console.log(`\n${alertas} alerta(s)`);
process.exit(alertas ? 1 : 0);

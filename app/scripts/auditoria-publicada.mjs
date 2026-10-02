// Auditoria da aplicação publicada (S3-08, repetida na S6-02; RNF-03, RNF-04).
//
//   node app/scripts/auditoria-publicada.mjs [https://bug-hunter-alpha.vercel.app]
//
// Sem login: as rotas da tentativa respondem 401, as telas logadas mandam ao login,
// e nem o HTML nem o JavaScript entregue ao navegador contêm credenciais ou o
// conteúdo oculto. Se existir app/.next/static (build local do mesmo código),
// varre também todos os pedaços de JavaScript, inclusive os das telas logadas.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] ?? "https://bug-hunter-alpha.vercel.app").replace(/\/$/, "");
const U = "00000000-0000-0000-0000-000000000000";
// marcas de credencial e nomes de campo que nunca podem estar no código do cliente
const PROIBIDO = /sb_secret_|SUPABASE_SERVICE_ROLE_KEY|FEEDBACK_API_KEY|EXECUTOR_SEGREDO|AIza[0-9A-Za-z_-]{20}|suite_oculta|categoria_codigo/;
let alertas = 0;
const linha = (ok, texto) => { if (!ok) alertas++; console.log(`${ok ? "ok    " : "ALERTA"}  ${texto}`); };

console.log(`alvo: ${BASE}\n\nrotas sem login:`);
const rotas = [
  ["POST", "/api/tentativa"], ["POST", "/api/localizar"], ["POST", "/api/editou"], ["POST", "/api/precheck"],
  ["POST", "/api/verificar"], ["POST", "/api/dica"], ["POST", "/api/encerrar"], ["POST", "/api/refazer"],
  ["POST", "/api/proximo"], ["GET", `/api/feedback/${U}`], ["POST", `/api/feedback/${U}`], ["GET", `/api/gabarito/${U}`],
];
for (const [metodo, rota] of rotas) {
  const r = await fetch(BASE + rota, { method: metodo, headers: { "content-type": "application/json" },
    body: metodo === "POST" ? JSON.stringify({ tentativa_id: U, tema: "fundamentos", nivel: "baixo", linha: 1, codigo: "x", nivel_dica: 1 }) : undefined });
  const corpo = await r.text();
  linha(r.status === 401 && !PROIBIDO.test(corpo), `${metodo} ${rota}: HTTP ${r.status}`);
}

console.log("\ntelas logadas, sem login:");
for (const tela of ["/temas", "/temas/fundamentos", `/exercicio/${U}`, `/exercicio/${U}/resultado`]) {
  const r = await fetch(BASE + tela, { redirect: "manual" });
  const destino = r.headers.get("location") ?? "";
  linha([302, 303, 307, 308].includes(r.status) && destino.includes("/login"), `${tela}: HTTP ${r.status} → ${destino.replace(BASE, "")}`);
}

console.log("\nHTML e JavaScript públicos:");
const scripts = new Set();
for (const pagina of ["/", "/login", "/cadastro"]) {
  const html = await (await fetch(BASE + pagina)).text();
  linha(!PROIBIDO.test(html), `HTML de ${pagina}`);
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s]+\.js/g)) scripts.add(m[0]);
}
let proibidos = 0;
for (const s of scripts) if (PROIBIDO.test(await (await fetch(BASE + s)).text())) proibidos++;
linha(proibidos === 0, `${scripts.size} scripts publicados, ${proibidos} com conteúdo proibido`);

const local = fileURLToPath(new URL("../.next/static", import.meta.url));
if (existsSync(local)) {
  const arquivos = [];
  const andar = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (p.endsWith(".js")) arquivos.push(p);
    }
  };
  andar(local);
  const ruins = arquivos.filter((p) => PROIBIDO.test(readFileSync(p, "utf8")));
  linha(ruins.length === 0, `build local: ${arquivos.length} pedaços de JavaScript, ${ruins.length} com conteúdo proibido`);
}

console.log(`\n${alertas} alerta(s)`);
process.exit(alertas ? 1 : 0);

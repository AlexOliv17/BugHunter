// Tempos de resposta da versão publicada (S6-04, RNF-02), medidos de fora, sem login.
//
//   node app/scripts/medir-tempos.mjs [https://bug-hunter-alpha.vercel.app] [https://bughunter-executor.vercel.app]
//
// Mostra a região onde a função rodou (cabeçalho x-vercel-id: borda::função) e a
// mediana e o p90 de 12 chamadas. /api/saude faz duas consultas ao banco em paralelo,
// e serve de medida do custo de ida e volta entre a função e o banco.

const app = (process.argv[2] ?? "https://bug-hunter-alpha.vercel.app").replace(/\/$/, "");
const executor = (process.argv[3] ?? "https://bughunter-executor.vercel.app").replace(/\/$/, "");

async function medir(nome, url) {
  const tempos = [];
  let regiao = "?";
  for (let i = 0; i < 12; i++) {
    const t0 = performance.now();
    const r = await fetch(url, { cache: "no-store" });
    await r.arrayBuffer();
    tempos.push(performance.now() - t0);
    regiao = (r.headers.get("x-vercel-id") ?? "?").split("::").slice(0, 2).join("::");
  }
  tempos.sort((a, b) => a - b);
  console.log(`${nome.padEnd(34)} ${regiao.padEnd(12)} mediana ${Math.round(tempos[6])} ms · p90 ${Math.round(tempos[10])} ms`);
}

await medir("/login (página)", `${app}/login`);
await medir("/api/saude (2 consultas ao banco)", `${app}/api/saude`);
await medir("executor (GET, sem execução)", `${executor}/api/executar`);

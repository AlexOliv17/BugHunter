// Conferência do PDR gravado em produção (S6-03, RF-14): para cada tentativa
// encerrada, recalcula calcularPdr a partir dos eventos e compara com pdr_final.
// Só roda quando pedido, com a chave de serviço do app/.env.local:
//
//   CONFERIR_PRODUCAO=1 npx vitest run scripts/conferir-pdr.test.ts
//
// Imprime só contagens e, se houver divergência, o começo do id da tentativa.

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Evento } from "../lib/estado";
import { BASE_POR_NIVEL, ehNivel } from "../lib/niveis";
import { calcularPdr } from "../lib/pdr";

const env = (chave: string) => readFileSync(".env.local", "utf8").match(new RegExp(`^${chave}=(.+)$`, "m"))?.[1].trim();

describe.skipIf(!process.env.CONFERIR_PRODUCAO)("PDR gravado = calcularPdr dos eventos (RF-14)", () => {
  it("todas as tentativas encerradas", async () => {
    const banco = createClient(env("NEXT_PUBLIC_SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: tentativas, error } = await banco.from("tentativas")
      .select("id, numero_tentativa, pdr_final, desfecho, exercicios(categorias_defeito(nivel))").neq("desfecho", "aberto");
    expect(error).toBeNull();

    const divergentes: string[] = [];
    const porDesfecho: Record<string, number> = {};
    for (const t of tentativas ?? []) {
      const { data: eventos } = await banco.from("eventos").select("tipo, payload").eq("tentativa_id", t.id).order("em").order("id");
      const { data: treino } = await banco.rpc("tentativa_e_treino", { p_tentativa: t.id });
      const nivel = (t.exercicios as unknown as { categorias_defeito: { nivel: string } }).categorias_defeito.nivel;
      const pdr = calcularPdr(eventos as Evento[], {
        base: BASE_POR_NIVEL[ehNivel(nivel) ? nivel : "baixo"], numero_tentativa: t.numero_tentativa, treino: treino === true,
      });
      porDesfecho[t.desfecho] = (porDesfecho[t.desfecho] ?? 0) + 1;
      if (pdr !== t.pdr_final) divergentes.push(`${t.id.slice(0, 8)}: gravado ${t.pdr_final}, recalculado ${pdr}`);
    }
    const resumo = `tentativas encerradas: ${tentativas?.length} ${JSON.stringify(porDesfecho)} · divergentes: ${divergentes.length}`;
    if (process.env.SAIDA_CONFERENCIA) writeFileSync(process.env.SAIDA_CONFERENCIA, [resumo, ...divergentes].join("\n"));
    console.log(resumo);
    divergentes.forEach((d) => console.log("  " + d));
    expect(divergentes).toEqual([]);
  }, 120_000);
});

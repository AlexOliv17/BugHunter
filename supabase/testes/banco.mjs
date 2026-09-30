// Postgres 17 real e descartável para testar as migrations (S2-07).
// Sobe um banco temporário, recria o que o Supabase já traz (schema auth,
// auth.uid(), papéis e privilégios padrão), aplica supabase/migrations em ordem
// e devolve conexões. Nada disso toca o banco de produção.

import EmbeddedPostgres from "embedded-postgres";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const MIGRATIONS = new URL("../migrations/", import.meta.url);

const SUPABASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const portaLivre = () => new Promise((resolve) => {
  const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

export async function subirBanco() {
  const pasta = mkdtempSync(join(tmpdir(), "bughunter-pg-"));
  const porta = await portaLivre();
  const servidor = new EmbeddedPostgres({
    databaseDir: pasta, port: porta, user: "postgres", password: "teste-local",
    persistent: false, onLog: () => {}, onError: () => {},
  });
  const config = { host: "localhost", port: porta, user: "postgres", password: "teste-local", database: "bughunter" };
  const conectar = async () => { const c = new pg.Client(config); await c.connect(); return c; };

  let admin;
  try {
    await servidor.initialise();
    await servidor.start();
    // banco em UTF-8, como no Supabase: no Windows o cluster nasce em WIN1252
    const raiz = new pg.Client({ ...config, database: "postgres" });
    await raiz.connect();
    await raiz.query("create database bughunter with encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'");
    await raiz.end();
    admin = await conectar();
    await admin.query(SUPABASE);
    for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) {
      try {
        await admin.query(readFileSync(new URL(f, MIGRATIONS), "utf8"));
      } catch (e) {
        throw new Error(`migration ${f}: ${e.message}`);
      }
    }
  } catch (e) {
    // não deixa um Postgres órfão segurando o teste
    await admin?.end().catch(() => {});
    await servidor.stop().catch(() => {});
    rmSync(pasta, { recursive: true, force: true });
    throw e;
  }

  return {
    admin,
    conectar,
    async encerrar() {
      await admin.end();
      await servidor.stop();
      rmSync(pasta, { recursive: true, force: true });
    },
  };
}

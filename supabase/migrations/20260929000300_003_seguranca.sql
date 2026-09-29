-- Migration 003 — leitura pública, permissões e RLS (S1-03)
-- Fonte: Modelo de Entidades e Relacionamentos §5 (RNF-03, RNF-04, DA-07, D-20).
-- Princípio: o cliente lê pouco e não escreve nada.

-- ─────────────────────────── 5.1 leitura ────────────────────────────

create view temas_publicos as
  select codigo, nome, descricao, ativo from temas;

-- progresso do aluno por tema (RF-03): só contagens
create function progresso_por_tema()
returns table (tema_codigo text, total bigint, resolvidos bigint)
language sql stable security definer set search_path = public as $$
  select p.tema_codigo, count(*), count(r.ok)
  from exercicios e
  join programas_base p on p.id = e.programa_base_id
  left join lateral (
    select 1 as ok from tentativas t
    where t.exercicio_id = e.id and t.usuario_id = auth.uid()
      and t.desfecho = 'resolvido' limit 1
  ) r on true
  where e.ativo
  group by p.tema_codigo;
$$;

-- níveis de um tema (RF-04): nomes das categorias do nível e contagens,
-- sem ligar categoria a exercício
create function niveis_do_tema(p_tema text)
returns table (nivel text, categorias text[], total bigint, resolvidos bigint)
language sql stable security definer set search_path = public as $$
  select c.nivel,
         array_agg(distinct c.nome order by c.nome),
         count(x.id),
         count(x.ok)
  from categorias_defeito c
  left join lateral (
    select e.id,
           (select 1 from tentativas t
            where t.exercicio_id = e.id and t.usuario_id = auth.uid()
              and t.desfecho = 'resolvido' limit 1) as ok
    from exercicios e
    join programas_base p on p.id = e.programa_base_id
    where e.categoria_codigo = c.codigo and e.ativo
      and p.tema_codigo = p_tema
  ) x on true
  group by c.nivel;
$$;

-- ────────────────────────── 5.2 permissões ──────────────────────────

-- o papel do cliente não enxerga tabela nenhuma
revoke all on temas, categorias_defeito, programas_base,
              exercicios, dicas, tentativas, eventos
  from anon, authenticated;

-- só a view, e só leitura. O revoke retira os privilégios que o Supabase
-- concede por padrão a objetos novos em public; sem ele a view, que é
-- atualizável automaticamente, aceitaria insert/update/delete em temas.
revoke all on temas_publicos from anon, authenticated;
grant select on temas_publicos to authenticated;

-- funções de agregado: o padrão do Postgres concede execute a public
revoke execute on function progresso_por_tema(), niveis_do_tema(text)
  from public, anon;
grant execute on function progresso_por_tema(), niveis_do_tema(text)
  to authenticated;

-- o perfil próprio, para o cabeçalho. O revoke retira os privilégios padrão
-- do Supabase (insert, delete, e tudo para anon), deixando só leitura e edição.
revoke all on usuarios from anon, authenticated;
grant select, update on usuarios to authenticated;

-- ─────────────────────── 5.3 row level security ─────────────────────

alter table usuarios   enable row level security;
alter table tentativas enable row level security;
alter table eventos    enable row level security;

create policy usuario_proprio on usuarios
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy tentativas_leitura on tentativas
  for select to authenticated using (usuario_id = auth.uid());

create policy eventos_leitura on eventos
  for select to authenticated using (
    exists (select 1 from tentativas t
            where t.id = eventos.tentativa_id and t.usuario_id = auth.uid())
  );

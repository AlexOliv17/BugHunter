-- Migration 015 — "Próximo exercício" da tela final (D-29, RN-09, RN-11)
-- Só para a chave de serviço, chamada por /api/proximo.

-- A partir de uma tentativa encerrada do aluno: a RN-09 no mesmo tema e nível,
-- excluindo o exercício dessa tentativa. Se o nível só tiver esse exercício, ele é
-- reaberto (vale metade, RN-07).
create function abrir_proximo(p_usuario uuid, p_tentativa uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_atual     uuid;
  v_desfecho  text;
  v_tema      text;
  v_nivel     text;
  v_tentativa uuid;
  v_exercicio uuid;
  v_numero    smallint;
begin
  select t.exercicio_id, t.desfecho, p.tema_codigo, c.nivel
    into v_atual, v_desfecho, v_tema, v_nivel
  from public.tentativas t
  join public.exercicios e         on e.id = t.exercicio_id
  join public.programas_base p     on p.id = e.programa_base_id
  join public.categorias_defeito c on c.codigo = e.categoria_codigo
  where t.id = p_tentativa and t.usuario_id = p_usuario;
  if not found then raise exception 'tentativa não encontrada' using errcode = 'BH001'; end if;
  if v_desfecho = 'aberto' then raise exception 'tentativa ainda aberta' using errcode = 'BH011'; end if;

  -- passo 1: tentativa aberta de outro exercício do nível (RN-10); não filtra ativo (D-21)
  select t.id into v_tentativa
  from public.tentativas t
  join public.exercicios e         on e.id = t.exercicio_id
  join public.categorias_defeito c on c.codigo = e.categoria_codigo
  join public.programas_base p     on p.id = e.programa_base_id
  where t.usuario_id = p_usuario and t.desfecho = 'aberto' and t.exercicio_id <> v_atual
    and p.tema_codigo = v_tema and c.nivel = v_nivel
  order by t.iniciada_em
  limit 1;
  if v_tentativa is not null then
    return v_tentativa;
  end if;

  -- passos 2 e 3, sem o atual: não resolvidos primeiro, depois pela ordem; só ativos.
  -- Sem nenhum outro, o próprio atual.
  select e.id into v_exercicio
  from public.exercicios e
  join public.categorias_defeito c on c.codigo = e.categoria_codigo
  join public.programas_base p     on p.id = e.programa_base_id
  left join lateral (
    select 1 as ok from public.tentativas t
    where t.exercicio_id = e.id and t.usuario_id = p_usuario and t.desfecho = 'resolvido'
    limit 1
  ) r on true
  where p.tema_codigo = v_tema and c.nivel = v_nivel and e.ativo
  order by (e.id = v_atual), (r.ok is not null), e.ordem
  limit 1;
  if v_exercicio is null then v_exercicio := v_atual; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_usuario::text || '|' || v_exercicio::text, 0));
  select t.id into v_tentativa
  from public.tentativas t
  where t.usuario_id = p_usuario and t.exercicio_id = v_exercicio and t.desfecho = 'aberto';
  if v_tentativa is not null then
    return v_tentativa;
  end if;

  select coalesce(max(t.numero_tentativa), 0) + 1 into v_numero
  from public.tentativas t
  where t.usuario_id = p_usuario and t.exercicio_id = v_exercicio;

  insert into public.tentativas (usuario_id, exercicio_id, numero_tentativa)
  values (p_usuario, v_exercicio, v_numero)
  returning id into v_tentativa;
  return v_tentativa;

exception when unique_violation then
  select t.id into v_tentativa
  from public.tentativas t
  where t.usuario_id = p_usuario and t.exercicio_id = v_exercicio and t.desfecho = 'aberto';
  return v_tentativa;
end;
$$;

revoke execute on function abrir_proximo(uuid, uuid) from public, anon, authenticated;
grant execute on function abrir_proximo(uuid, uuid) to service_role;

-- Migration 014 — refazer o mesmo exercício (S5-07, RF-16, RN-07, RN-11)
-- Só para a chave de serviço, chamada por /api/refazer.

-- A partir de uma tentativa encerrada do aluno, abre outra do mesmo exercício com
-- numero_tentativa = maior + 1 (RN-11); o multiplicador 0,5 sai disso (RN-07).
-- Se já houver uma aberta desse exercício (RN-10), devolve essa. Vale também para
-- exercício desativado (D-21): o aluno já o conhece e pediu para refazê-lo.
create function refazer_exercicio(p_usuario uuid, p_tentativa uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_exercicio uuid;
  v_desfecho  text;
  v_tentativa uuid;
  v_numero    smallint;
begin
  select t.exercicio_id, t.desfecho into v_exercicio, v_desfecho
  from public.tentativas t
  where t.id = p_tentativa and t.usuario_id = p_usuario;
  if not found then raise exception 'tentativa não encontrada' using errcode = 'BH001'; end if;
  if v_desfecho = 'aberto' then raise exception 'tentativa ainda aberta' using errcode = 'BH011'; end if;

  -- mesma serialização de abrir_tentativa: um aluno, um exercício, uma requisição por vez
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

revoke execute on function refazer_exercicio(uuid, uuid) from public, anon, authenticated;
grant execute on function refazer_exercicio(uuid, uuid) to service_role;

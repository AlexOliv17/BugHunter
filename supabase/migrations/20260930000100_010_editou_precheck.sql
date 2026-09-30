-- Migration 010 — eventos editou e precheck (S3-07, RF-08, RF-09, RN-02, RN-12)
-- Só para a chave de serviço, chamadas por /api/editou e /api/precheck.

-- Estado da localização a partir dos eventos: concluída quando houve acerto ou 2 tentativas (RN-01).
create function localizacao_concluida(p_tentativa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(bool_or((ev.payload ->> 'correta')::boolean), false) or count(*) >= 2
  from public.eventos ev
  where ev.tentativa_id = p_tentativa and ev.tipo = 'localizou';
$$;

-- editou {codigo, linhas_alteradas} (RN-12). linhas_alteradas vem do servidor da
-- aplicação, que o calcula contra codigo_com_defeito (RN-08).
create function registrar_edicao(p_usuario uuid, p_tentativa uuid, p_codigo text, p_linhas_alteradas integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_desfecho text;
  v_original text;
begin
  select t.desfecho, e.codigo_com_defeito into v_desfecho, v_original
  from public.tentativas t join public.exercicios e on e.id = t.exercicio_id
  where t.id = p_tentativa and t.usuario_id = p_usuario
  for update of t;
  if not found then raise exception 'tentativa não encontrada' using errcode = 'BH001'; end if;
  if v_desfecho <> 'aberto' then raise exception 'tentativa encerrada' using errcode = 'BH002'; end if;
  if p_linhas_alteradas < 0 then raise exception 'contagem inválida' using errcode = 'BH005'; end if;
  -- com o editor travado não há edição possível: só o código recebido é aceito
  if not public.localizacao_concluida(p_tentativa) and p_codigo <> v_original then
    raise exception 'editor ainda travado' using errcode = 'BH006';
  end if;

  insert into public.eventos (tentativa_id, tipo, payload)
  values (p_tentativa, 'editou', jsonb_build_object('codigo', p_codigo, 'linhas_alteradas', p_linhas_alteradas));
end;
$$;

-- precheck {resultado, obtido, numero_uso} (RF-09). numero_uso é atribuído aqui;
-- no máximo 3 por tentativa (RN-02), e só com o editor destravado.
create function registrar_precheck(p_usuario uuid, p_tentativa uuid, p_resultado text, p_obtido text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_desfecho text;
  v_usos integer;
begin
  select t.desfecho into v_desfecho
  from public.tentativas t
  where t.id = p_tentativa and t.usuario_id = p_usuario
  for update;
  if not found then raise exception 'tentativa não encontrada' using errcode = 'BH001'; end if;
  if v_desfecho <> 'aberto' then raise exception 'tentativa encerrada' using errcode = 'BH002'; end if;
  if p_resultado not in ('passou', 'falhou', 'tempo_excedido', 'erro') then
    raise exception 'resultado inválido' using errcode = 'BH005';
  end if;
  if not public.localizacao_concluida(p_tentativa) then
    raise exception 'editor ainda travado' using errcode = 'BH006';
  end if;

  select count(*) into v_usos from public.eventos ev where ev.tentativa_id = p_tentativa and ev.tipo = 'precheck';
  if v_usos >= 3 then raise exception 'prechecks esgotados' using errcode = 'BH007'; end if;

  insert into public.eventos (tentativa_id, tipo, payload)
  values (p_tentativa, 'precheck', jsonb_build_object('resultado', p_resultado, 'obtido', p_obtido, 'numero_uso', v_usos + 1));
  return v_usos + 1;
end;
$$;

revoke execute on function localizacao_concluida(uuid) from public, anon, authenticated;
revoke execute on function registrar_edicao(uuid, uuid, text, integer) from public, anon, authenticated;
revoke execute on function registrar_precheck(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function localizacao_concluida(uuid) to service_role;
grant execute on function registrar_edicao(uuid, uuid, text, integer) to service_role;
grant execute on function registrar_precheck(uuid, uuid, text, text) to service_role;

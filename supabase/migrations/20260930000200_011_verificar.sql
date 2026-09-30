-- Migration 011 — Verificar (S4-02, RF-10, RN-03)
-- Só para a chave de serviço, chamadas por /api/verificar. A suíte oculta sai do
-- banco só para o servidor da aplicação, que manda ao executor apenas as entradas.

-- Suíte e nome da função de uma tentativa aberta, com o editor destravado.
-- suite_oculta vai como texto: o servidor precisa do texto original de cada número
-- para distinguir 8 de 8.0 (D-27).
create function suite_da_tentativa(p_usuario uuid, p_tentativa uuid)
returns table (suite_oculta text, nome_funcao text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_desfecho text;
begin
  select t.desfecho into v_desfecho
  from public.tentativas t
  where t.id = p_tentativa and t.usuario_id = p_usuario;
  if not found then raise exception 'tentativa não encontrada' using errcode = 'BH001'; end if;
  if v_desfecho <> 'aberto' then raise exception 'tentativa encerrada' using errcode = 'BH002'; end if;
  if not public.localizacao_concluida(p_tentativa) then
    raise exception 'editor ainda travado' using errcode = 'BH006';
  end if;

  return query
    select p.suite_oculta, p.nome_funcao
    from public.tentativas t
    join public.exercicios e     on e.id = t.exercicio_id
    join public.programas_base p on p.id = e.programa_base_id
    where t.id = p_tentativa;
end;
$$;

-- verificar {resultado, passados, total}; se passou, também encerrou {desfecho: resolvido}
-- e a tentativa é fechada com o PDR calculado pelo servidor (RN-05).
--
-- p_eventos_vistos: quantos eventos a tentativa tinha quando o PDR foi calculado.
-- Se outro evento entrou nesse meio-tempo, o PDR pode estar desatualizado: nada é
-- gravado e o servidor recalcula (BH008).
create function registrar_verificar(
  p_usuario uuid, p_tentativa uuid, p_resultado text, p_passados integer, p_total integer,
  p_pdr integer, p_eventos_vistos integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_desfecho text;
  v_eventos integer;
begin
  select t.desfecho into v_desfecho
  from public.tentativas t
  where t.id = p_tentativa and t.usuario_id = p_usuario
  for update;
  if not found then raise exception 'tentativa não encontrada' using errcode = 'BH001'; end if;
  if v_desfecho <> 'aberto' then raise exception 'tentativa encerrada' using errcode = 'BH002'; end if;
  if p_resultado not in ('passou', 'falhou', 'tempo_excedido', 'erro')
     or p_total < 1 or p_passados < 0 or p_passados > p_total
     or (p_resultado = 'passou') <> (p_passados = p_total)
     or (p_resultado = 'passou' and (p_pdr is null or p_pdr < 0)) then
    raise exception 'resultado inválido' using errcode = 'BH005';
  end if;
  if not public.localizacao_concluida(p_tentativa) then
    raise exception 'editor ainda travado' using errcode = 'BH006';
  end if;

  select count(*) into v_eventos from public.eventos ev where ev.tentativa_id = p_tentativa;
  if v_eventos <> p_eventos_vistos then
    raise exception 'eventos mudaram durante o cálculo' using errcode = 'BH008';
  end if;

  insert into public.eventos (tentativa_id, tipo, payload)
  values (p_tentativa, 'verificar', jsonb_build_object('resultado', p_resultado, 'passados', p_passados, 'total', p_total));

  if p_resultado = 'passou' then
    insert into public.eventos (tentativa_id, tipo, payload)
    values (p_tentativa, 'encerrou', jsonb_build_object('desfecho', 'resolvido'));
    update public.tentativas
       set desfecho = 'resolvido', fechada_em = now(), pdr_final = p_pdr
     where id = p_tentativa;
    return true;
  end if;
  return false;
end;
$$;

revoke execute on function suite_da_tentativa(uuid, uuid) from public, anon, authenticated;
revoke execute on function registrar_verificar(uuid, uuid, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function suite_da_tentativa(uuid, uuid) to service_role;
grant execute on function registrar_verificar(uuid, uuid, text, integer, integer, integer, integer) to service_role;

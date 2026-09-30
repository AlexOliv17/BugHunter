-- Migration 012 — dicas graduadas (S4-05, RF-12, RN-04)
-- Só para a chave de serviço, chamadas por /api/dica e /api/tentativa. O texto sai
-- da tabela dicas (categoria do exercício); o código da categoria nunca sai (RNF-03).

-- Condição de liberação, verificada aqui antes de devolver qualquer texto (RN-04):
--   1: editor destravado; 2: dica 1 usada e ao menos um Verificar sem sucesso; 3: dica 2 usada.
-- Pedir de novo uma dica já usada devolve o mesmo texto, sem novo evento nem novo custo.
create function solicitar_dica(p_usuario uuid, p_tentativa uuid, p_nivel integer)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_desfecho text;
  v_categoria text;
  v_usadas integer[];
  v_falhas integer;
  v_texto text;
begin
  select t.desfecho, e.categoria_codigo into v_desfecho, v_categoria
  from public.tentativas t join public.exercicios e on e.id = t.exercicio_id
  where t.id = p_tentativa and t.usuario_id = p_usuario
  for update of t;
  if not found then raise exception 'tentativa não encontrada' using errcode = 'BH001'; end if;
  if v_desfecho <> 'aberto' then raise exception 'tentativa encerrada' using errcode = 'BH002'; end if;
  if p_nivel is null or p_nivel not between 1 and 3 then raise exception 'nível inválido' using errcode = 'BH005'; end if;

  select coalesce(array_agg(distinct (ev.payload ->> 'nivel')::integer), '{}') into v_usadas
  from public.eventos ev where ev.tentativa_id = p_tentativa and ev.tipo = 'dica';

  if not p_nivel = any(v_usadas) then
    select count(*) into v_falhas from public.eventos ev
    where ev.tentativa_id = p_tentativa and ev.tipo = 'verificar' and ev.payload ->> 'resultado' <> 'passou';
    if (p_nivel = 1 and not public.localizacao_concluida(p_tentativa))
       or (p_nivel = 2 and not (1 = any(v_usadas) and v_falhas > 0))
       or (p_nivel = 3 and not 2 = any(v_usadas)) then
      raise exception 'dica % ainda não liberada', p_nivel using errcode = 'BH009';
    end if;
  end if;

  select d.texto into v_texto from public.dicas d
  where d.categoria_codigo = v_categoria and d.nivel_dica = p_nivel;
  if v_texto is null then raise exception 'dica sem texto' using errcode = 'BH010'; end if;

  if not p_nivel = any(v_usadas) then
    insert into public.eventos (tentativa_id, tipo, payload)
    values (p_tentativa, 'dica', jsonb_build_object('nivel', p_nivel));
  end if;
  return v_texto;
end;
$$;

-- Textos das dicas já usadas numa tentativa do aluno, para retomar a tela (RN-10).
create function dicas_da_tentativa(p_usuario uuid, p_tentativa uuid)
returns table (nivel integer, texto text)
language sql stable security definer set search_path = '' as $$
  select d.nivel_dica::integer, d.texto
  from public.tentativas t
  join public.exercicios e on e.id = t.exercicio_id
  join public.dicas d      on d.categoria_codigo = e.categoria_codigo
  where t.id = p_tentativa and t.usuario_id = p_usuario
    and exists (select 1 from public.eventos ev
                where ev.tentativa_id = t.id and ev.tipo = 'dica'
                  and (ev.payload ->> 'nivel')::integer = d.nivel_dica)
  order by d.nivel_dica;
$$;

revoke execute on function solicitar_dica(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function dicas_da_tentativa(uuid, uuid) from public, anon, authenticated;
grant execute on function solicitar_dica(uuid, uuid, integer) to service_role;
grant execute on function dicas_da_tentativa(uuid, uuid) to service_role;

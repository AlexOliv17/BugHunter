-- Migration 009 — registro da localização do defeito (S3-03, RF-07, RN-01)
-- A comparação com linha_defeito acontece aqui, no banco; quem chama recebe só
-- "correta ou não" e se a localização terminou (RNF-03). Só para a chave de serviço.

create function registrar_localizacao(p_usuario uuid, p_tentativa uuid, p_linha integer)
returns table (correta boolean, tentativa_num integer, concluida boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_desfecho text;
  v_linha_defeito integer;
  v_codigo text;
  v_anteriores integer;
  v_ja_acertou boolean;
  v_correta boolean;
  v_num integer;
begin
  -- trava a tentativa: cliques simultâneos são processados um de cada vez
  select t.desfecho, e.linha_defeito, e.codigo_com_defeito
    into v_desfecho, v_linha_defeito, v_codigo
  from public.tentativas t
  join public.exercicios e on e.id = t.exercicio_id
  where t.id = p_tentativa and t.usuario_id = p_usuario
  for update of t;

  if not found then
    raise exception 'tentativa não encontrada' using errcode = 'BH001';
  end if;
  if v_desfecho <> 'aberto' then
    raise exception 'tentativa encerrada' using errcode = 'BH002';
  end if;
  if p_linha < 1 or p_linha > array_length(string_to_array(v_codigo, E'\n'), 1) then
    raise exception 'linha fora do código' using errcode = 'BH004';
  end if;

  select count(*), coalesce(bool_or((ev.payload ->> 'correta')::boolean), false)
    into v_anteriores, v_ja_acertou
  from public.eventos ev
  where ev.tentativa_id = p_tentativa and ev.tipo = 'localizou';

  -- RN-01: no máximo duas tentativas; depois de um acerto não há outra
  if v_ja_acertou or v_anteriores >= 2 then
    raise exception 'localização já concluída' using errcode = 'BH003';
  end if;

  v_correta := p_linha = v_linha_defeito;
  v_num := v_anteriores + 1;

  insert into public.eventos (tentativa_id, tipo, payload)
  values (p_tentativa, 'localizou', jsonb_build_object('linha', p_linha, 'correta', v_correta, 'tentativa_num', v_num));

  return query select v_correta, v_num, (v_correta or v_num = 2);
end;
$$;

revoke execute on function registrar_localizacao(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function registrar_localizacao(uuid, uuid, integer) to service_role;

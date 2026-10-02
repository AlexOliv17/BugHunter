-- Migration 016 — repetição de exercício já resolvido é treino (D-31, RN-07, RF-16)
-- A nota do exercício é a da primeira tentativa resolvida. Enquanto ele não foi
-- resolvido, a repetição pontua com 0,5 (RN-07); depois de resolvido, toda nova
-- tentativa é treino e fecha com pdr_final = 0. Só para a chave de serviço.

-- Treino: já existe, antes desta, uma tentativa resolvida do mesmo exercício pelo aluno.
-- Como só há uma tentativa aberta por exercício (RN-10), isso não muda depois de aberta.
create function tentativa_e_treino(p_tentativa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tentativas t
    join public.tentativas r on r.usuario_id = t.usuario_id and r.exercicio_id = t.exercicio_id
    where t.id = p_tentativa and r.numero_tentativa < t.numero_tentativa and r.desfecho = 'resolvido'
  );
$$;

-- exercicio_da_tentativa ganha a coluna treino (o tipo de retorno muda: recria)
drop function exercicio_da_tentativa(uuid, uuid);
create function exercicio_da_tentativa(p_usuario uuid, p_tentativa uuid)
returns table (
  tentativa_id uuid, numero_tentativa smallint, desfecho text,
  codigo_com_defeito text, assinatura text, descricao text, teste_exemplo jsonb,
  tema_codigo text, nivel text, treino boolean
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.numero_tentativa, t.desfecho,
         e.codigo_com_defeito, p.assinatura, p.descricao, p.teste_exemplo,
         p.tema_codigo, c.nivel, public.tentativa_e_treino(t.id)
  from public.tentativas t
  join public.exercicios e         on e.id = t.exercicio_id
  join public.programas_base p     on p.id = e.programa_base_id
  join public.categorias_defeito c on c.codigo = e.categoria_codigo
  where t.id = p_tentativa and t.usuario_id = p_usuario;
$$;

-- dados_do_encerramento ganha treino e ja_resolvido (para o texto do botão de refazer)
drop function dados_do_encerramento(uuid, uuid);
create function dados_do_encerramento(p_usuario uuid, p_tentativa uuid)
returns table (
  desfecho text, pdr_final integer, numero_tentativa smallint, feedback_texto text,
  assinatura text, descricao text, nome_funcao text,
  codigo_com_defeito text, codigo_correto text, linha_defeito integer,
  categoria_nome text, categoria_descricao text, nivel text, tema_codigo text,
  treino boolean, ja_resolvido boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_desfecho text;
begin
  select t.desfecho into v_desfecho
  from public.tentativas t
  where t.id = p_tentativa and t.usuario_id = p_usuario;
  if not found then raise exception 'tentativa não encontrada' using errcode = 'BH001'; end if;
  if v_desfecho = 'aberto' then raise exception 'tentativa ainda aberta' using errcode = 'BH011'; end if;

  return query
    select t.desfecho, t.pdr_final, t.numero_tentativa, t.feedback_texto,
           p.assinatura, p.descricao, p.nome_funcao,
           e.codigo_com_defeito, p.codigo_correto, e.linha_defeito,
           c.nome, c.descricao_curta, c.nivel, p.tema_codigo,
           public.tentativa_e_treino(t.id),
           exists (select 1 from public.tentativas r
                   where r.usuario_id = t.usuario_id and r.exercicio_id = t.exercicio_id
                     and r.desfecho = 'resolvido')
    from public.tentativas t
    join public.exercicios e         on e.id = t.exercicio_id
    join public.programas_base p     on p.id = e.programa_base_id
    join public.categorias_defeito c on c.codigo = e.categoria_codigo
    where t.id = p_tentativa;
end;
$$;

-- registrar_verificar: tentativa de treino fecha com PDR 0
create or replace function registrar_verificar(
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
       set desfecho = 'resolvido', fechada_em = now(),
           -- treino não pontua (D-31), qualquer que seja o PDR enviado
           pdr_final = case when public.tentativa_e_treino(p_tentativa) then 0 else p_pdr end
     where id = p_tentativa;
    return true;
  end if;
  return false;
end;
$$;

revoke execute on function tentativa_e_treino(uuid) from public, anon, authenticated;
revoke execute on function exercicio_da_tentativa(uuid, uuid) from public, anon, authenticated;
revoke execute on function dados_do_encerramento(uuid, uuid) from public, anon, authenticated;
grant execute on function tentativa_e_treino(uuid) to service_role;
grant execute on function exercicio_da_tentativa(uuid, uuid) to service_role;
grant execute on function dados_do_encerramento(uuid, uuid) to service_role;

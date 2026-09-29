-- Migration 008 — abertura ou retomada da tentativa (S2-06, RF-05, RN-09, RN-10, RN-11)
-- As duas funções rodam só com a chave de serviço, chamadas por POST /api/tentativa.

-- RN-09: (1) retoma a tentativa aberta do tema e nível, sem filtrar por ativo;
-- (2) senão, o não resolvido de menor ordem; (3) senão, o de menor ordem (RN-07).
-- RN-11: numero_tentativa = maior existente + 1, nesta mesma transação.
create function abrir_tentativa(p_usuario uuid, p_tema text, p_nivel text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_tentativa uuid;
  v_exercicio uuid;
  v_numero    smallint;
begin
  -- passo 1: tentativa aberta no tema e nível (RN-10); não filtra ativo (D-21)
  select t.id into v_tentativa
  from public.tentativas t
  join public.exercicios e         on e.id = t.exercicio_id
  join public.categorias_defeito c on c.codigo = e.categoria_codigo
  join public.programas_base p     on p.id = e.programa_base_id
  where t.usuario_id = p_usuario and t.desfecho = 'aberto'
    and p.tema_codigo = p_tema and c.nivel = p_nivel
  order by t.iniciada_em
  limit 1;
  if v_tentativa is not null then
    return v_tentativa;
  end if;

  -- passos 2 e 3: não resolvidos primeiro, depois pela ordem; só exercícios ativos
  select e.id into v_exercicio
  from public.exercicios e
  join public.categorias_defeito c on c.codigo = e.categoria_codigo
  join public.programas_base p     on p.id = e.programa_base_id
  left join lateral (
    select 1 as ok from public.tentativas t
    where t.exercicio_id = e.id and t.usuario_id = p_usuario and t.desfecho = 'resolvido'
    limit 1
  ) r on true
  where p.tema_codigo = p_tema and c.nivel = p_nivel and e.ativo
  order by (r.ok is not null), e.ordem
  limit 1;
  if v_exercicio is null then
    raise exception 'não há exercícios neste tema e nível' using errcode = 'P0002';
  end if;

  -- serializa requisições simultâneas do mesmo aluno para o mesmo exercício
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
  -- garantia final contra corrida (RF-05): a outra requisição criou; devolve a dela
  select t.id into v_tentativa
  from public.tentativas t
  where t.usuario_id = p_usuario and t.exercicio_id = v_exercicio and t.desfecho = 'aberto';
  return v_tentativa;
end;
$$;

-- O exercício de uma tentativa aberta do aluno, só com colunas públicas (D-20).
-- Nunca devolve suite_oculta, codigo_correto, linha_defeito nem categoria_codigo (RNF-03).
create function exercicio_da_tentativa(p_usuario uuid, p_tentativa uuid)
returns table (
  tentativa_id uuid, numero_tentativa smallint, desfecho text,
  codigo_com_defeito text, assinatura text, descricao text, teste_exemplo jsonb,
  tema_codigo text, nivel text
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.numero_tentativa, t.desfecho,
         e.codigo_com_defeito, p.assinatura, p.descricao, p.teste_exemplo,
         p.tema_codigo, c.nivel
  from public.tentativas t
  join public.exercicios e         on e.id = t.exercicio_id
  join public.programas_base p     on p.id = e.programa_base_id
  join public.categorias_defeito c on c.codigo = e.categoria_codigo
  where t.id = p_tentativa and t.usuario_id = p_usuario;
$$;

revoke execute on function abrir_tentativa(uuid, text, text) from public, anon, authenticated;
revoke execute on function exercicio_da_tentativa(uuid, uuid) from public, anon, authenticated;
grant execute on function abrir_tentativa(uuid, text, text) to service_role;
grant execute on function exercicio_da_tentativa(uuid, uuid) to service_role;

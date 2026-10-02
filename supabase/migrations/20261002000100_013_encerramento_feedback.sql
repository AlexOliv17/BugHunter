-- Migration 013 — encerramento por desistência, feedback e gabarito (S5-01 a S5-04,
-- RF-13, RF-15, RN-06). Só para a chave de serviço.

-- Desistência (RN-06, D-17): grava editou com o código atual (RN-12) e encerrou
-- {desfecho: desistiu}; a tentativa fecha com pdr_final = 0. Vale com o editor
-- travado: nesse caso só o código recebido é aceito, como em registrar_edicao.
create function encerrar_por_desistencia(p_usuario uuid, p_tentativa uuid, p_codigo text, p_linhas_alteradas integer)
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
  if not public.localizacao_concluida(p_tentativa) and p_codigo <> v_original then
    raise exception 'editor ainda travado' using errcode = 'BH006';
  end if;

  insert into public.eventos (tentativa_id, tipo, payload)
  values (p_tentativa, 'editou', jsonb_build_object('codigo', p_codigo, 'linhas_alteradas', p_linhas_alteradas));
  insert into public.eventos (tentativa_id, tipo, payload)
  values (p_tentativa, 'encerrou', jsonb_build_object('desfecho', 'desistiu'));
  update public.tentativas
     set desfecho = 'desistiu', fechada_em = now(), pdr_final = 0
   where id = p_tentativa;
end;
$$;

-- Tudo o que o feedback e a tela final precisam (RF-15, Documentação §7.2), só de
-- tentativa encerrada do próprio aluno: antes disso, estes campos não saem (RNF-03).
create function dados_do_encerramento(p_usuario uuid, p_tentativa uuid)
returns table (
  desfecho text, pdr_final integer, numero_tentativa smallint, feedback_texto text,
  assinatura text, descricao text, nome_funcao text,
  codigo_com_defeito text, codigo_correto text, linha_defeito integer,
  categoria_nome text, categoria_descricao text, nivel text, tema_codigo text
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
           c.nome, c.descricao_curta, c.nivel, p.tema_codigo
    from public.tentativas t
    join public.exercicios e         on e.id = t.exercicio_id
    join public.programas_base p     on p.id = e.programa_base_id
    join public.categorias_defeito c on c.codigo = e.categoria_codigo
    where t.id = p_tentativa;
end;
$$;

-- O feedback é gravado uma vez (RF-15, Documentação §7.4): o primeiro texto fica;
-- uma segunda geração simultânea não o substitui. Devolve o texto que ficou.
create function gravar_feedback(p_tentativa uuid, p_texto text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_texto text;
begin
  update public.tentativas
     set feedback_texto = coalesce(feedback_texto, p_texto)
   where id = p_tentativa and desfecho <> 'aberto'
  returning feedback_texto into v_texto;
  if not found then raise exception 'tentativa não encerrada' using errcode = 'BH011'; end if;
  return v_texto;
end;
$$;

revoke execute on function encerrar_por_desistencia(uuid, uuid, text, integer) from public, anon, authenticated;
revoke execute on function dados_do_encerramento(uuid, uuid) from public, anon, authenticated;
revoke execute on function gravar_feedback(uuid, text) from public, anon, authenticated;
grant execute on function encerrar_por_desistencia(uuid, uuid, text, integer) to service_role;
grant execute on function dados_do_encerramento(uuid, uuid) to service_role;
grant execute on function gravar_feedback(uuid, text) to service_role;

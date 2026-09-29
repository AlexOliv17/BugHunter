-- Migration 007 — linha em usuarios criada junto com a conta (S2-03, RF-01)
-- A linha nasce na mesma transação em que o Supabase Auth cria auth.users, com o
-- mesmo id; o nome vem dos metadados enviados pelo cadastro. Sem nome, o cadastro
-- é recusado, inclusive quando feito direto pela API do Auth, fora da tela.

create function criar_usuario_da_conta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nome_informado text := nullif(btrim(new.raw_user_meta_data ->> 'nome'), '');
begin
  if nome_informado is null then
    raise exception 'o cadastro exige um nome (RF-01)';
  end if;
  insert into public.usuarios (id, email, nome) values (new.id, new.email, nome_informado);
  return new;
end;
$$;

revoke execute on function criar_usuario_da_conta() from public, anon, authenticated;

create trigger usuarios_no_cadastro
  after insert on auth.users
  for each row execute function criar_usuario_da_conta();

-- contas criadas antes deste gatilho (testes da S2-01 e S2-02)
insert into public.usuarios (id, email, nome)
select u.id, u.email,
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nome'), ''), split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.usuarios p where p.id = u.id);

-- Migration 002 — tabelas operacionais (S1-02)
-- Fonte: Modelo de Entidades e Relacionamentos §4 (E-01, E-07, E-08).
-- Escritas somente pelo servidor; permissões e RLS vêm na migration 003.

create table usuarios (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  nome       text not null,
  criado_em  timestamptz not null default now()
);

create table tentativas (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references usuarios(id) on delete restrict,
  exercicio_id     uuid not null references exercicios(id) on delete restrict,
  numero_tentativa smallint not null check (numero_tentativa > 0),
  iniciada_em      timestamptz not null default now(),
  fechada_em       timestamptz,
  desfecho         text not null default 'aberto'
                   check (desfecho in ('aberto', 'resolvido', 'desistiu')),
  pdr_final        integer check (pdr_final >= 0),
  feedback_texto   text,
  constraint coerencia_fechamento check (
    (desfecho = 'aberto'  and fechada_em is null     and pdr_final is null) or
    (desfecho <> 'aberto' and fechada_em is not null and pdr_final is not null)
  ),
  constraint tentativa_unica unique (usuario_id, exercicio_id, numero_tentativa)
);

create table eventos (
  id           bigint primary key generated always as identity,
  tentativa_id uuid not null references tentativas(id) on delete restrict,
  em           timestamptz not null default now(),
  tipo         text not null check (tipo in
               ('localizou','editou','precheck','verificar','dica','encerrou')),
  payload      jsonb not null default '{}'::jsonb
);

create index idx_tentativas_usuario   on tentativas (usuario_id);
create index idx_tentativas_exercicio on tentativas (exercicio_id);
create index idx_tentativas_fechadas  on tentativas (usuario_id, fechada_em)
                                       where desfecho <> 'aberto';
create index idx_eventos_tentativa    on eventos (tentativa_id, em, id);

-- só uma tentativa aberta por aluno e exercício (RN-10)
create unique index idx_uma_aberta_por_exercicio
  on tentativas (usuario_id, exercicio_id)
  where desfecho = 'aberto';

-- eventos são somente inserção para qualquer papel, inclusive o servidor (RF-17, D-23)
create function eventos_imutaveis() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'eventos são imutáveis: % não é permitido (RF-17)', tg_op;
end;
$$;

create trigger eventos_sem_alteracao
  before update or delete on eventos
  for each row execute function eventos_imutaveis();

create trigger eventos_sem_truncate
  before truncate on eventos
  for each statement execute function eventos_imutaveis();

revoke execute on function eventos_imutaveis() from public, anon, authenticated;

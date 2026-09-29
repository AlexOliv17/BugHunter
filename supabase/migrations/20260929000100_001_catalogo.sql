-- Migration 001 — tabelas de catálogo (S1-01)
-- Fonte: Modelo de Entidades e Relacionamentos §4 (E-02 a E-06).
-- Permissões e RLS vêm na migration 003; as três são aplicadas juntas.

create table temas (
  codigo      text primary key,
  nome        text not null,
  descricao   text not null,
  ativo       boolean not null default false
);

create table categorias_defeito (
  codigo          text primary key,
  nome            text not null,
  nivel           text not null check (nivel in ('baixo', 'medio')),
  descricao_curta text not null
);

create table programas_base (
  id              uuid primary key,
  tema_codigo     text not null references temas(codigo),
  nome_funcao     text not null,
  assinatura      text not null,
  descricao       text not null,
  codigo_correto  text not null,
  teste_exemplo   jsonb not null,
  suite_oculta    text not null,
  unique (tema_codigo, nome_funcao)
);

create table exercicios (
  id                 uuid primary key,
  programa_base_id   uuid not null references programas_base(id),
  categoria_codigo   text not null references categorias_defeito(codigo),
  ordem              integer not null,
  codigo_com_defeito text not null,
  linha_defeito      integer not null check (linha_defeito > 0),
  mutador_versao     text not null,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now()
);

create table dicas (
  categoria_codigo text not null references categorias_defeito(codigo),
  nivel_dica       smallint not null check (nivel_dica between 1 and 3),
  texto            text not null,
  primary key (categoria_codigo, nivel_dica)
);

create index idx_programas_tema       on programas_base (tema_codigo);
create index idx_exercicios_programa  on exercicios (programa_base_id);
create index idx_exercicios_categoria on exercicios (categoria_codigo);

-- ordem única só entre os exercícios ativos (D-21)
create unique index idx_exercicios_ordem_ativa
  on exercicios (ordem)
  where ativo;

-- Migration 005 — ordem de exibição dos temas (S1-05, D-25)
-- RF-03 pede os temas "ordenadas"; a ordem passa a ser definida pelo autor do conteúdo.

alter table temas add column ordem integer not null unique;

-- a view ganha a coluna no fim; grants e revoke da migration 003 se mantêm
create or replace view temas_publicos as
  select codigo, nome, descricao, ativo, ordem from temas;

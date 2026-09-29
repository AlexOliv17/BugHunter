-- Migration 004 — o aluno edita só o próprio nome (D-24)
-- O e-mail vem do login (auth.users) e não é editável pelo cliente na v1.

revoke update on usuarios from authenticated;
grant update (nome) on usuarios to authenticated;

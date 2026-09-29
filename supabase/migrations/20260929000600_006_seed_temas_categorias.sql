-- Migration 006 — carga de temas e categorias de defeito (S1-05)
-- Textos aprovados pelo P.O. Não são segredo: os nomes das categorias
-- aparecem na tela de nível (RF-04). Programas-base e dicas vêm do
-- repositório privado, pelo pipeline (D-22).

insert into temas (codigo, nome, descricao, ativo, ordem) values
  ('fundamentos', 'Fundamentos de Programação',      'Variáveis, condicionais, laços, listas e funções.', true,  1),
  ('poo',         'Programação Orientada a Objetos', 'Classes, objetos, herança e encapsulamento.',       false, 2),
  ('ed1',         'Estrutura de Dados I',            'Listas encadeadas, pilhas e filas.',                false, 3),
  ('ed2',         'Estrutura de Dados II',           'Árvores, grafos e tabelas de dispersão.',           false, 4);

insert into categorias_defeito (codigo, nome, nivel, descricao_curta) values
  ('CMP_INV',      'comparador invertido',        'baixo',
   'Uma comparação usa o operador vizinho do correto, como < no lugar de <=, e erra justamente no caso de igualdade.'),
  ('ARIT_TROC',    'operador aritmético trocado', 'baixo',
   'Uma operação aritmética usa o operador errado, como + no lugar de - ou * no lugar de /.'),
  ('LACO_DESL',    'limite de laço deslocado',    'medio',
   'O limite de um range está deslocado em uma unidade, e o laço não termina onde deveria.'),
  ('ACUM_AUSENTE', 'acumulador não atualizado',   'medio',
   'Falta a atualização do acumulador dentro do laço, então o valor acumulado não muda como deveria.');

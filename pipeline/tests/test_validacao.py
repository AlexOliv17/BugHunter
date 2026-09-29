"""Testes dos critérios de validade e da linha_defeito (S1-10). Programas fictícios."""

import ast
import unittest
from unittest import mock

from bughunter_pipeline import validacao
from bughunter_pipeline.conteudo import ProgramaBase, canonico, id_programa
from bughunter_pipeline.validacao import (ErroDeLinha, avaliar, avaliar_programa, nos_alterados,
                                          primeira_linha_divergente)

# Texto-fonte "sujo" de propósito: aspas, parênteses e comentário que o ast.unparse
# normaliza. Se a comparação fosse contra o fonte, a divergência cairia na linha 1.
FONTE = '''def pontua(valores, minimo):
    # soma os pontos dos valores acima do mínimo
    pontos = ( 0 )
    for i in range(len(valores)):
        if valores[i] < minimo:
            continue
        pontos += valores[i]
    rotulo = "ok"
    return pontos
'''
CANON = canonico(FONTE)
LINHAS = CANON.splitlines()


def programa(casos=None, categorias=("CMP_INV", "ARIT_TROC", "LACO_DESL", "ACUM_AUSENTE")):
    casos = casos or [
        {"entrada": [[1, 6, 7], 5], "esperado": 13},
        {"entrada": [[], 3], "esperado": 0},
        {"entrada": [[2, 9], 3], "esperado": 9},
        {"entrada": [[4, 4], 4], "esperado": 8},
    ]
    return ProgramaBase(id=id_programa("fundamentos", "pontua"), tema_codigo="fundamentos", nome_funcao="pontua",
                        assinatura="pontua(valores, minimo)", descricao="d", codigo_correto=CANON,
                        categorias=tuple(categorias), teste_exemplo={"chamada": "pontua([1, 6, 7], 5)",
                        "entrada": [[1, 6, 7], 5], "esperado": 13}, suite_oculta=casos, arquivo="t")


def linha_com(trecho):
    return next(i for i, l in enumerate(LINHAS, start=1) if trecho in l)


class TestFormaCanonica(unittest.TestCase):
    def test_canonico_tem_numeracao_propria(self):
        # o comentário some: no canônico, "pontos = 0" é a linha 2, e não a 3 do fonte
        self.assertEqual(LINHAS[1], "    pontos = 0")
        self.assertEqual(linha_com("if valores[i] < minimo"), 4)

    def test_comparar_com_o_fonte_daria_linha_errada(self):
        mutado = avaliar(programa(), "CMP_INV", 1).codigo
        self.assertEqual(primeira_linha_divergente(FONTE, mutado), 2)  # o erro que a §6.1 descreve
        self.assertEqual(primeira_linha_divergente(CANON, mutado), 4)


class TestLinhaDefeito(unittest.TestCase):
    def test_cmp_inv_aponta_a_comparacao(self):
        c = avaliar(programa(), "CMP_INV", 1)
        self.assertTrue(c.valido, c.motivo)
        self.assertEqual(c.linha_defeito, linha_com("if valores[i]"))
        self.assertIn("<= minimo", c.codigo.splitlines()[c.linha_defeito - 1])

    def test_arit_troc_aponta_a_conta(self):
        c = avaliar(programa(), "ARIT_TROC", 1)
        self.assertTrue(c.valido, c.motivo)
        self.assertEqual(c.linha_defeito, linha_com("pontos += valores[i]"))
        self.assertIn("pontos -= valores[i]", c.codigo.splitlines()[c.linha_defeito - 1])

    def test_laco_desl_aponta_o_range(self):
        c = avaliar(programa(), "LACO_DESL", 1)
        self.assertTrue(c.valido, c.motivo)
        self.assertEqual(c.linha_defeito, linha_com("for i in range"))
        self.assertIn("range(len(valores) - 1)", c.codigo.splitlines()[c.linha_defeito - 1])

    def test_acum_ausente_aponta_a_linha_anterior_a_remocao(self):
        c = avaliar(programa(), "ACUM_AUSENTE", 1)
        self.assertTrue(c.valido, c.motivo)
        # removido "pontos += valores[i]"; a linha anterior, no mutado, é o "continue"
        self.assertEqual(c.linha_defeito, linha_com("pontos += valores[i]") - 1)
        self.assertEqual(c.codigo.splitlines()[c.linha_defeito - 1].strip(), "continue")
        self.assertNotIn("pontos += valores[i]", c.codigo)


class TestCriterios(unittest.TestCase):
    def test_mutacao_inocua_e_descartada(self):
        # sem nota igual ao mínimo na suíte, < e <= dão o mesmo resultado
        casos = [{"entrada": [[1, 9], 5], "esperado": 9}, {"entrada": [[], 3], "esperado": 0}]
        c = avaliar(programa(casos), "CMP_INV", 1)
        self.assertFalse(c.valido)
        self.assertIn("inócua", c.motivo)

    def test_remocao_que_nao_compila_e_descartada(self):
        fonte = "def f(xs):\n    t = 0\n    for x in xs:\n        t += x\n    return t"
        p = ProgramaBase(id=id_programa("fundamentos", "f"), tema_codigo="fundamentos", nome_funcao="f",
                         assinatura="f(xs)", descricao="d", codigo_correto=canonico(fonte),
                         categorias=("ACUM_AUSENTE",), teste_exemplo={"chamada": "f([1])", "entrada": [[1]], "esperado": 1},
                         suite_oculta=[{"entrada": [[1, 2]], "esperado": 3}], arquivo="t")
        (c,) = avaliar_programa(p)
        self.assertFalse(c.valido)
        self.assertEqual(c.motivo, "não compila")

    def test_exemplo_quebrado_nao_descarta(self):
        # D-12: o candidato que quebra o teste de exemplo continua válido
        c = avaliar(programa(), "ARIT_TROC", 1)
        self.assertTrue(c.valido)
        self.assertFalse(c.passa_no_exemplo)

    def test_marca_os_que_passam_no_exemplo(self):
        c = avaliar(programa(), "CMP_INV", 1)  # exemplo sem empate: passa; a borda [4, 4] falha
        self.assertTrue(c.valido and c.passa_no_exemplo)

    def test_contagem_de_passados(self):
        c = avaliar(programa(), "CMP_INV", 1)
        self.assertEqual((c.passados, c.total), (3, 4))


class TestNosAlterados(unittest.TestCase):
    def n(self, a, b):
        return nos_alterados(ast.parse(a), ast.parse(b))

    def test_um_no(self):
        self.assertEqual(self.n("x = a < b", "x = a <= b"), 1)
        self.assertEqual(self.n("for i in range(n):\n    pass", "for i in range(n - 1):\n    pass"), 1)
        self.assertEqual(self.n("x = 1\ny = 2\nz = 3", "x = 1\nz = 3"), 1)

    def test_nenhum_e_varios(self):
        self.assertEqual(self.n("x = a < b", "x = a < b"), 0)
        self.assertEqual(self.n("x = a < b\ny = c + d", "x = a <= b\ny = c - d"), 2)


class TestCaminhosDivergentes(unittest.TestCase):
    def test_pipeline_para_se_texto_e_arvore_discordam(self):
        with mock.patch.object(validacao, "linha_pela_arvore", return_value=99):
            with self.assertRaises(ErroDeLinha):
                avaliar(programa(), "CMP_INV", 1)

    def test_linhas_identicas_consecutivas_param_o_pipeline(self):
        # removendo a primeira de duas linhas iguais, o texto só diverge uma linha depois
        fonte = "def f(xs):\n    t = 0\n    for x in xs:\n        t += 1\n        t += 1\n    return t"
        p = ProgramaBase(id=id_programa("fundamentos", "f"), tema_codigo="fundamentos", nome_funcao="f",
                         assinatura="f(xs)", descricao="d", codigo_correto=canonico(fonte),
                         categorias=("ACUM_AUSENTE",), teste_exemplo={"chamada": "f([1])", "entrada": [[1]], "esperado": 2},
                         suite_oculta=[{"entrada": [[1, 2]], "esperado": 4}], arquivo="t")
        with self.assertRaises(ErroDeLinha):
            avaliar(p, "ACUM_AUSENTE", 1)


if __name__ == "__main__":
    unittest.main()

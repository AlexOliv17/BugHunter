"""Testes dos mutadores (S1-09). Programas fictícios, fora do catálogo."""

import ast
import unittest

from bughunter_pipeline.mutadores import AlvoInvalido, conta_ocorrencias, elegiveis, mutar

PROG = """def f(xs, limite):
    total = 0
    contagem = 0
    for i in range(len(xs)):
        if xs[i] > limite and xs[i] <= 100:
            total += xs[i] * 2
            contagem = contagem + 1
    if contagem >= 1:
        return total / contagem
    return 0
"""


def canon(fonte):
    return ast.unparse(ast.parse(fonte))


class TestContagem(unittest.TestCase):
    def test_contagens(self):
        # CMP: xs[i] > limite, xs[i] <= 100, contagem >= 1
        self.assertEqual(conta_ocorrencias(PROG, "CMP_INV"), 3)
        # ARIT, em ordem de código: total += ..., xs[i] * 2, contagem + 1, total / contagem
        self.assertEqual(conta_ocorrencias(PROG, "ARIT_TROC"), 4)
        self.assertEqual(conta_ocorrencias(PROG, "LACO_DESL"), 1)
        # ACUM: total += ... e contagem = ... (as atribuições fora do laço não contam)
        self.assertEqual(conta_ocorrencias(PROG, "ACUM_AUSENTE"), 2)

    def test_ordem_e_estavel(self):
        a = [ast.dump(n) for n in elegiveis(ast.parse(PROG), "ARIT_TROC")]
        b = [ast.dump(n) for n in elegiveis(ast.parse(PROG), "ARIT_TROC")]
        self.assertEqual(a, b)

    def test_so_o_primeiro_operador_da_comparacao_conta(self):
        self.assertEqual(conta_ocorrencias("x = a == b < c", "CMP_INV"), 0)
        self.assertEqual(conta_ocorrencias("x = a < b == c", "CMP_INV"), 1)

    def test_operadores_fora_da_troca_nao_contam(self):
        self.assertEqual(conta_ocorrencias("x = a % 2 + b // 3 - c ** 2", "ARIT_TROC"), 2)


class TestCmpInv(unittest.TestCase):
    def test_troca_so_o_alvo(self):
        esperado = PROG.replace("xs[i] <= 100", "xs[i] < 100")
        self.assertEqual(mutar(PROG, "CMP_INV", 2), canon(esperado))

    def test_cada_troca(self):
        for de, para in (("<", "<="), ("<=", "<"), (">", ">="), (">=", ">")):
            with self.subTest(de=de):
                self.assertEqual(mutar(f"x = a {de} b", "CMP_INV", 1), f"x = a {para} b")


class TestAritTroc(unittest.TestCase):
    def test_augassign_e_binop_na_mesma_sequencia(self):
        self.assertEqual(mutar(PROG, "ARIT_TROC", 1), canon(PROG.replace("total += xs[i] * 2", "total -= xs[i] * 2")))
        self.assertEqual(mutar(PROG, "ARIT_TROC", 2), canon(PROG.replace("xs[i] * 2", "xs[i] / 2")))
        self.assertEqual(mutar(PROG, "ARIT_TROC", 3), canon(PROG.replace("contagem + 1", "contagem - 1")))
        self.assertEqual(mutar(PROG, "ARIT_TROC", 4), canon(PROG.replace("total / contagem", "total * contagem")))

    def test_cada_troca(self):
        for de, para in (("+", "-"), ("-", "+"), ("*", "/"), ("/", "*")):
            with self.subTest(de=de):
                self.assertEqual(mutar(f"x = a {de} b", "ARIT_TROC", 1), f"x = a {para} b")
                self.assertEqual(mutar(f"x {de}= b", "ARIT_TROC", 1), f"x {para}= b")


class TestLacoDesl(unittest.TestCase):
    def test_um_argumento_muda_o_stop(self):
        self.assertEqual(mutar("for i in range(n):\n    pass", "LACO_DESL", 1), "for i in range(n - 1):\n    pass")

    def test_dois_argumentos_muda_o_stop(self):
        self.assertEqual(mutar("for i in range(1, len(v)):\n    pass", "LACO_DESL", 1),
                         "for i in range(1, len(v) - 1):\n    pass")

    def test_tres_argumentos_muda_o_stop_e_nao_o_passo(self):
        # D-18: o stop -1 vira -2, escrito já calculado; o passo -1 fica intacto
        self.assertEqual(mutar("for i in range(k, -1, -1):\n    pass", "LACO_DESL", 1),
                         "for i in range(k, -2, -1):\n    pass")

    def test_stop_com_subtracao_e_recalculado(self):
        self.assertEqual(mutar("for i in range(len(v) - 1):\n    pass", "LACO_DESL", 1),
                         "for i in range(len(v) - 2):\n    pass")

    def test_stop_com_soma_de_um_some(self):
        self.assertEqual(mutar("for i in range(n + 1):\n    pass", "LACO_DESL", 1), "for i in range(n):\n    pass")

    def test_stop_constante(self):
        self.assertEqual(mutar("for i in range(10):\n    pass", "LACO_DESL", 1), "for i in range(9):\n    pass")


class TestAcumAusente(unittest.TestCase):
    def test_remove_so_o_alvo(self):
        esperado = PROG.replace("            contagem = contagem + 1\n", "")
        self.assertEqual(mutar(PROG, "ACUM_AUSENTE", 2), canon(esperado))

    def test_laco_aninhado_conta_uma_vez(self):
        fonte = "for a in x:\n    for b in y:\n        t += b\n        s = b\n    u = a"
        self.assertEqual(conta_ocorrencias(fonte, "ACUM_AUSENTE"), 3)
        self.assertEqual(mutar(fonte, "ACUM_AUSENTE", 1), "for a in x:\n    for b in y:\n        s = b\n    u = a")

    def test_remover_a_unica_linha_do_bloco_gera_codigo_que_nao_compila(self):
        # quem descarta é o critério 2 da S1-10 (compila)
        saida = mutar("for a in x:\n    t += a", "ACUM_AUSENTE", 1)
        with self.assertRaises(SyntaxError):
            compile(saida, "x", "exec")

    def test_while_tambem_e_laco(self):
        self.assertEqual(conta_ocorrencias("while c:\n    n -= 1\n    k = 2", "ACUM_AUSENTE"), 2)


class TestAlvo(unittest.TestCase):
    def test_alvo_fora_do_intervalo(self):
        for alvo in (0, 4):
            with self.subTest(alvo=alvo), self.assertRaises(AlvoInvalido):
                mutar(PROG, "CMP_INV", alvo)

    def test_mutar_nao_altera_a_fonte_nem_outras_ocorrencias(self):
        saida = mutar(PROG, "CMP_INV", 1)
        self.assertIn("xs[i] <= 100", saida)
        self.assertIn("contagem >= 1", saida)
        self.assertIn("xs[i] >= limite", saida)


if __name__ == "__main__":
    unittest.main()

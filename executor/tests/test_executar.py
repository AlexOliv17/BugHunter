"""Testes do executor (S4-01). Rodam em qualquer sistema; os limites do sistema
operacional (memória, arquivos) só existem no Linux e são verificados na S4-07."""

import json
import sys
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "api"))

import executar as ex  # noqa: E402

MEDIA = "def media(notas):\n    return sum(notas) / len(notas)\n"
FIO = json.loads((RAIZ / "tests" / "dados" / "fio.json").read_text(encoding="utf-8"))["casos"]


class Fio(unittest.TestCase):
    def test_casos_de_referencia(self):
        for caso in FIO:
            with self.subTest(fonte=caso["fonte"]):
                valor = json.loads(caso["fonte"])
                self.assertEqual(ex.codificar(valor), caso["fio"])
                self.assertEqual(ex.decodificar(caso["fio"]), valor)
                self.assertIs(type(ex.decodificar(caso["fio"])), type(valor))

    def test_float_especiais(self):
        for v in (float("inf"), float("-inf")):
            self.assertEqual(ex.decodificar(ex.codificar(v)), v)
        self.assertEqual(ex.codificar(float("nan")), {"t": "float", "v": "nan"})

    def test_fio_malformado(self):
        for ruim in ({"t": "int", "v": 8}, {"t": "x"}, [1], {"t": "list", "v": "a"}, {"t": "bool", "v": 1}):
            with self.subTest(ruim=ruim), self.assertRaises(ex.PedidoInvalido):
                ex.decodificar(ruim)


class Execucao(unittest.TestCase):
    def test_devolve_os_valores_obtidos(self):
        r = ex.executar(MEDIA, "media", [[[7, 8, 9]], [[10]], [[1, 2]]])
        self.assertEqual(r, {"situacao": "ok", "resultados": [
            {"valor": {"t": "float", "v": "8.0"}}, {"valor": {"t": "float", "v": "10.0"}}, {"valor": {"t": "float", "v": "1.5"}}]})

    def test_preserva_decimal_na_entrada(self):
        r = ex.executar("def f(x):\n    return repr(x)\n", "f", [[8.0], [8]])
        self.assertEqual([x["valor"]["v"] for x in r["resultados"]], ["8.0", "8"])

    def test_tupla_vira_lista_como_no_pipeline(self):
        r = ex.executar("def f():\n    return (1, 2)\n", "f", [[]])
        self.assertEqual(r["resultados"][0]["valor"]["t"], "list")

    def test_excecao_em_um_caso_nao_afeta_os_outros(self):
        r = ex.executar(MEDIA, "media", [[[1]], [[]]])
        self.assertEqual(r["situacao"], "ok")
        self.assertEqual(r["resultados"][1], {"erro": "ZeroDivisionError"})

    def test_mensagem_da_excecao_nao_sai(self):
        # a mensagem poderia conter a entrada oculta (RN-03)
        r = ex.executar("def f(d):\n    return d['segredo']\n", "f", [[{}]])
        self.assertEqual(r["resultados"][0], {"erro": "KeyError"})

    def test_erro_de_sintaxe(self):
        r = ex.executar("def media(:\n", "media", [[[1]]])
        self.assertEqual(r["situacao"], "erro")
        self.assertEqual(r["erro"], "SyntaxError")

    def test_funcao_ausente(self):
        self.assertEqual(ex.executar("x = 1\n", "media", [[[1]]])["erro"], "KeyError")

    def test_exit_do_aluno_nao_escapa(self):
        r = ex.executar("import sys\ndef f():\n    sys.exit(0)\n", "f", [[]])
        self.assertEqual(r["resultados"][0], {"erro": "SystemExit"})

    def test_print_do_aluno_e_descartado(self):
        r = ex.executar("def f():\n    print('x' * 100000)\n    return 1\n", "f", [[]])
        self.assertEqual(r["resultados"][0], {"valor": {"t": "int", "v": "1"}})

    def test_valor_nao_serializavel(self):
        r = ex.executar("def f():\n    return {1, 2}\n", "f", [[]])
        self.assertEqual(r["resultados"][0], {"erro": "TypeError"})

    def test_laco_infinito(self):
        r = ex.executar("def f():\n    while True:\n        pass\n", "f", [[]], limite_s=1)
        self.assertEqual(r, {"situacao": "tempo_excedido", "resultados": []})

    def test_resultado_forjado_pelo_aluno_e_recusado(self):
        codigo = ("import sys, json\n"
                  "def f():\n"
                  "    open(sys.argv[1], 'w').write(json.dumps({'carregou': True, 'resultados': []}))\n"
                  "    import os; os._exit(0)\n")
        self.assertEqual(ex.executar(codigo, "f", [[]])["situacao"], "erro")

    def test_ambiente_do_filho_sem_variaveis_do_pai(self):
        codigo = "import os\ndef f():\n    return sorted(k for k in os.environ if k != 'SYSTEMROOT')\n"
        r = ex.executar(codigo, "f", [[]])
        self.assertEqual(r["resultados"][0], {"valor": {"t": "list", "v": []}})


class Pedido(unittest.TestCase):
    def corpo(self, **mudar):
        base = {"codigo": MEDIA, "funcao": "media", "entradas": [ex.codificar([[1, 2]])]}
        base.update(mudar)
        return json.dumps(base)

    def test_valido(self):
        self.assertEqual(ex.ler_pedido(self.corpo()), (MEDIA, "media", [[[1, 2]]]))

    def test_invalidos(self):
        for mudar in ({"funcao": "os.system"}, {"funcao": 1}, {"codigo": "x" * 20_001}, {"entradas": []},
                      {"entradas": [ex.codificar(1)]}, {"entradas": [{"t": "int", "v": 1}]}):
            with self.subTest(mudar=mudar), self.assertRaises(ex.PedidoInvalido):
                ex.ler_pedido(self.corpo(**mudar))

    def test_nao_aceita_esperado(self):
        # o formato não tem campo para o esperado; um campo a mais é simplesmente ignorado
        self.assertEqual(len(ex.ler_pedido(self.corpo(esperado=[1]))), 3)


class Autorizacao(unittest.TestCase):
    def test_segredo(self):
        self.assertTrue(ex.autorizado("Bearer abc", "abc"))
        self.assertFalse(ex.autorizado("Bearer abd", "abc"))
        self.assertFalse(ex.autorizado(None, "abc"))

    def test_sem_segredo_configurado_ninguem_entra(self):
        self.assertFalse(ex.autorizado("Bearer ", ""))
        self.assertFalse(ex.autorizado("Bearer None", None))


if __name__ == "__main__":
    unittest.main()

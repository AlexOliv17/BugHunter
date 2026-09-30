"""Testes da estrutura do pipeline (S1-07). Rodar em pipeline/: python -m unittest -v"""

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from bughunter_pipeline.comparacao import iguais
from bughunter_pipeline.config import ErroDeConfiguracao, REPO_PUBLICO, validar_conteudo_dir
from bughunter_pipeline.conteudo import (ConteudoInvalido, canonico, carregar_dicas,
                                         carregar_programa, carregar_programas, id_programa)
from bughunter_pipeline.executor import executar_suite, montar_pedido

DADOS = Path(__file__).parent / "dados"
EXEMPLO = DADOS / "conteudo_exemplo"
DOBRO = "def dobro(x):\n    return x * 2\n"
CASOS = [{"entrada": [3], "esperado": 6}, {"entrada": [0], "esperado": 0}, {"entrada": [-2], "esperado": -4}]


class TestComparacao(unittest.TestCase):
    def test_casos_de_referencia(self):
        for caso in json.loads((DADOS / "comparacao.json").read_text(encoding="utf-8"))["casos"]:
            with self.subTest(motivo=caso["motivo"], obtido=caso["obtido"]):
                self.assertIs(iguais(caso["obtido"], caso["esperado"]), caso["iguais"])


class TestExecutor(unittest.TestCase):
    def test_passou(self):
        r = executar_suite(DOBRO, "dobro", CASOS)
        self.assertEqual((r.resultado, r.passados, r.total), ("passou", 3, 3))

    def test_falhou_conta_os_casos(self):
        r = executar_suite(DOBRO.replace("x * 2", "x + 2"), "dobro", CASOS)  # dá 5, 2 e 0: os três casos erram
        self.assertEqual((r.resultado, r.passados, r.falhas), ("falhou", 0, [0, 1, 2]))

    def test_excecao_num_caso_conta_como_falha(self):
        codigo = "def dobro(x):\n    return 12 // x\n"  # x=0 lança ZeroDivisionError
        r = executar_suite(codigo, "dobro", CASOS)
        self.assertEqual(r.resultado, "falhou")
        self.assertIn(1, r.falhas)

    def test_codigo_que_nao_carrega_e_erro(self):
        r = executar_suite("def dobro(x):\n    return nao_existe\nraise ValueError()", "dobro", CASOS)
        self.assertEqual(r.resultado, "erro")

    def test_laco_infinito_e_tempo_excedido(self):
        r = executar_suite("def dobro(x):\n    while True:\n        pass\n", "dobro", CASOS, limite_s=1)
        self.assertEqual(r.resultado, "tempo_excedido")

    def test_processo_recebe_so_as_entradas(self):
        pedido = montar_pedido(DOBRO, "dobro", [{"entrada": [1], "esperado": "SEGREDO_ESPERADO"}])
        self.assertNotIn("SEGREDO_ESPERADO", pedido)
        self.assertNotIn("esperado", pedido)


class TestConfig(unittest.TestCase):
    def test_recusa_conteudo_dentro_do_repositorio_publico(self):
        with self.assertRaises(ErroDeConfiguracao):
            validar_conteudo_dir(str(REPO_PUBLICO / "pipeline"))

    def test_recusa_pasta_inexistente(self):
        with self.assertRaises(ErroDeConfiguracao):
            validar_conteudo_dir(str(REPO_PUBLICO.parent / "nao-existe-bh"))

    def test_aceita_pasta_fora_do_repositorio(self):
        pasta = Path(tempfile.mkdtemp())
        try:
            self.assertEqual(validar_conteudo_dir(str(pasta)), pasta.resolve())
        finally:
            shutil.rmtree(pasta)


class TestConteudo(unittest.TestCase):
    def test_carrega_programa_exemplo(self):
        (p,) = carregar_programas(EXEMPLO)
        self.assertEqual(p.nome_funcao, "dobro")
        self.assertEqual(p.codigo_correto, "def dobro(x):\n    return x * 2")  # canônico, sem comentário
        self.assertEqual(p.id, id_programa("fundamentos", "dobro"))
        self.assertEqual(json.loads(p.linha_banco()["suite_oculta"])[0], {"entrada": [3], "esperado": 6})
        self.assertEqual((p.teste_exemplo["entrada_repr"], p.teste_exemplo["esperado_repr"]), ("3", "6"))

    def test_repr_preserva_decimal(self):
        arq = self._programa_alterado(teste_exemplo={"chamada": "dobro(0.5)", "entrada": [0.5], "esperado": 1.0},
                                      suite_oculta=[{"entrada": [0.5], "esperado": 1.0}, {"entrada": [2], "esperado": 4}])
        self.assertEqual(carregar_programa(arq).teste_exemplo["esperado_repr"], "1.0")

    def test_id_e_estavel(self):
        self.assertEqual(str(id_programa("fundamentos", "dobro")), str(id_programa("fundamentos", "dobro")))
        self.assertNotEqual(id_programa("fundamentos", "dobro"), id_programa("poo", "dobro"))

    def test_canonico_normaliza(self):
        self.assertEqual(canonico("x = ( 1+2 )  # c\ny='a'"), "x = 1 + 2\ny = 'a'")

    def test_dicas_exemplo(self):
        linhas = carregar_dicas(EXEMPLO)
        self.assertEqual(len(linhas), 12)

    def _programa_alterado(self, **mudancas):
        dados = json.loads((EXEMPLO / "programas_base" / "dobro.json").read_text(encoding="utf-8"))
        dados.update(mudancas)
        pasta = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, pasta)
        arquivo = pasta / "dobro.json"
        arquivo.write_text(json.dumps(dados), encoding="utf-8")
        return arquivo

    def test_recusa_correto_que_falha_na_suite(self):
        arq = self._programa_alterado(suite_oculta=[{"entrada": [3], "esperado": 7}, {"entrada": [1], "esperado": 2}])
        with self.assertRaisesRegex(ConteudoInvalido, "não passa em suite_oculta"):
            carregar_programa(arq)

    def test_recusa_suite_sem_caso_fora_do_exemplo(self):
        arq = self._programa_alterado(suite_oculta=[{"entrada": [3], "esperado": 6}])
        with self.assertRaisesRegex(ConteudoInvalido, "fora do exemplo"):
            carregar_programa(arq)

    def test_recusa_categoria_desconhecida(self):
        with self.assertRaisesRegex(ConteudoInvalido, "categorias inválidas"):
            carregar_programa(self._programa_alterado(categorias=["NOVA"]))

    def test_recusa_codigo_com_outra_funcao(self):
        arq = self._programa_alterado(codigo="def dobro(x):\n    return 2*x\n\ndef extra():\n    pass\n")
        with self.assertRaisesRegex(ConteudoInvalido, "só a função"):
            carregar_programa(arq)


if __name__ == "__main__":
    unittest.main()

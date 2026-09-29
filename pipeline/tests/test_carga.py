"""Testes da carga idempotente (S1-11). Programas fictícios."""

import unittest

from bughunter_pipeline import MUTADOR_VERSAO
from bughunter_pipeline.carga import carregar_exercicios, id_exercicio, montar_linhas
from tests.test_validacao import programa
from bughunter_pipeline.validacao import avaliar_programa

NIVEIS = {"CMP_INV": "baixo", "ARIT_TROC": "baixo", "LACO_DESL": "medio", "ACUM_AUSENTE": "medio"}


def validos():
    return [c for c in avaliar_programa(programa()) if c.valido]


class BancoFalso:
    def __init__(self):
        self.chamadas = []

    def atualizar(self, tabela, filtro, valores):
        self.chamadas.append(("atualizar", tabela, filtro, valores))
        return 2

    def upsert(self, tabela, linhas, conflito):
        self.chamadas.append(("upsert", tabela, [dict(l) for l in linhas], conflito))
        return len(linhas)


class TestMontarLinhas(unittest.TestCase):
    def test_mesma_entrada_mesma_saida(self):
        self.assertEqual(montar_linhas(validos(), NIVEIS), montar_linhas(validos(), NIVEIS))

    def test_id_depende_da_chave_natural(self):
        c = validos()[0]
        self.assertEqual(id_exercicio(c), id_exercicio(validos()[0]))
        self.assertNotEqual(id_exercicio(validos()[0]), id_exercicio(validos()[1]))

    def test_ordem_unica_e_baixo_antes_de_medio(self):
        linhas = montar_linhas(validos(), NIVEIS)
        ordens = [l["ordem"] for l in linhas]
        self.assertEqual(sorted(ordens), list(range(1, len(linhas) + 1)))
        baixo = [l["ordem"] for l in linhas if NIVEIS[l["categoria_codigo"]] == "baixo"]
        medio = [l["ordem"] for l in linhas if NIVEIS[l["categoria_codigo"]] == "medio"]
        self.assertLess(max(baixo), min(medio))

    def test_ordem_nao_depende_da_ordem_de_entrada(self):
        v = validos()
        a = {l["id"]: l["ordem"] for l in montar_linhas(v, NIVEIS)}
        b = {l["id"]: l["ordem"] for l in montar_linhas(list(reversed(v)), NIVEIS)}
        self.assertEqual(a, b)

    def test_campos_da_linha(self):
        l = montar_linhas(validos(), NIVEIS)[0]
        self.assertEqual(set(l), {"id", "programa_base_id", "categoria_codigo", "ordem", "codigo_com_defeito",
                                  "linha_defeito", "mutador_versao", "ativo"})
        self.assertEqual((l["mutador_versao"], l["ativo"]), (MUTADOR_VERSAO, True))

    def test_categoria_sem_nivel_para(self):
        with self.assertRaises(ValueError):
            montar_linhas(validos(), {"CMP_INV": "baixo"})


class TestCarregar(unittest.TestCase):
    def test_desativa_grava_negativo_e_depois_definitivo(self):
        banco, linhas = BancoFalso(), montar_linhas(validos(), NIVEIS)
        r = carregar_exercicios(banco, linhas)
        (op1, t1, filtro, valores), (op2, _, fase1, _), (op3, _, fase2, _) = banco.chamadas
        self.assertEqual((op1, t1, valores), ("atualizar", "exercicios", {"ativo": False}))
        self.assertIn("id=not.in.(", filtro)
        self.assertTrue(all(l["ordem"] < 0 for l in fase1))
        self.assertEqual(fase2, linhas)
        self.assertEqual(r, {"gravados": len(linhas), "desativados": 2})


if __name__ == "__main__":
    unittest.main()

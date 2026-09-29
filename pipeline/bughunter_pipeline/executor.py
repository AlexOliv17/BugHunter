"""Executor de suíte do pipeline (S1-07).

Roda o código num processo Python separado, com limite de tempo, passando só as
entradas dos casos; o processo devolve os valores obtidos e a comparação com o
esperado acontece aqui, fora dele (D-26). No pipeline o código é do autor do
conteúdo, portanto confiável; o isolamento do Verificar é tratado na S4-01.
"""

import json
import subprocess
import sys
from dataclasses import dataclass, field

from .comparacao import iguais

LIMITE_S = 5

# Lido pelo processo filho via stdin: {"codigo", "funcao", "entradas"}.
_EXECUTA = r"""
import json, sys
pedido = json.loads(sys.stdin.read())
saida = {"carregou": True, "resultados": []}
escopo = {}
try:
    exec(compile(pedido["codigo"], "exercicio.py", "exec"), escopo)
    funcao = escopo[pedido["funcao"]]
except Exception as e:
    saida = {"carregou": False, "erro": type(e).__name__}
else:
    for argumentos in pedido["entradas"]:
        try:
            valor = funcao(*argumentos)
            json.dumps(valor)
            saida["resultados"].append({"valor": valor})
        except Exception as e:
            saida["resultados"].append({"erro": type(e).__name__})
sys.stdout.write("\n__BUGHUNTER__" + json.dumps(saida))
"""


@dataclass
class ResultadoSuite:
    resultado: str  # passou | falhou | tempo_excedido | erro
    passados: int = 0
    total: int = 0
    falhas: list = field(default_factory=list)  # índices dos casos que falharam


def montar_pedido(codigo: str, funcao: str, casos: list[dict]) -> str:
    """Mensagem enviada ao processo: só código, nome da função e entradas — nunca o esperado."""
    return json.dumps({"codigo": codigo, "funcao": funcao, "entradas": [c["entrada"] for c in casos]})


def executar_suite(codigo: str, funcao: str, casos: list[dict], limite_s: float = LIMITE_S) -> ResultadoSuite:
    total = len(casos)
    pedido = montar_pedido(codigo, funcao, casos)
    try:
        proc = subprocess.run(
            [sys.executable, "-I", "-c", _EXECUTA],
            input=pedido, capture_output=True, text=True, timeout=limite_s,
        )
    except subprocess.TimeoutExpired:
        return ResultadoSuite("tempo_excedido", 0, total, list(range(total)))

    marcador = proc.stdout.rfind("\n__BUGHUNTER__")
    if marcador < 0:
        return ResultadoSuite("erro", 0, total, list(range(total)))
    saida = json.loads(proc.stdout[marcador + len("\n__BUGHUNTER__"):])
    if not saida["carregou"]:
        return ResultadoSuite("erro", 0, total, list(range(total)))

    falhas = [
        i for i, (caso, r) in enumerate(zip(casos, saida["resultados"]))
        if "erro" in r or not iguais(r["valor"], caso["esperado"])
    ]
    passados = total - len(falhas)
    return ResultadoSuite("passou" if not falhas else "falhou", passados, total, falhas)

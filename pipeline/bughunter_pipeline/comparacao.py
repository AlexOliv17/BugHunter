"""Regra de comparação entre valor obtido e esperado (D-27).

Números decimais: tolerância relativa de 1e-9 do esperado. Inteiros, textos e
valores lógicos: igualdade exata. Listas: mesmo tamanho, elemento a elemento.
A mesma regra é usada no Precheck e no Verificar; os casos de referência ficam
em tests/dados/comparacao.json para que as implementações não divirjam.
"""

import math

TOLERANCIA_RELATIVA = 1e-9


def _numero(valor) -> bool:
    return isinstance(valor, (int, float)) and not isinstance(valor, bool)


def iguais(obtido, esperado) -> bool:
    if isinstance(esperado, bool) or isinstance(obtido, bool):
        return type(obtido) is type(esperado) and obtido == esperado
    if _numero(esperado) and _numero(obtido):
        if isinstance(esperado, float) or isinstance(obtido, float):
            return math.isclose(obtido, esperado, rel_tol=TOLERANCIA_RELATIVA, abs_tol=0.0)
        return obtido == esperado
    if isinstance(esperado, list) and isinstance(obtido, list):
        return len(obtido) == len(esperado) and all(iguais(o, e) for o, e in zip(obtido, esperado))
    if isinstance(esperado, dict) and isinstance(obtido, dict):
        return obtido.keys() == esperado.keys() and all(iguais(obtido[k], esperado[k]) for k in esperado)
    return type(obtido) is type(esperado) and obtido == esperado

# Núcleo do Precheck (S3-06, RF-09), executado no Pyodide do navegador.
# Roda o código do aluno contra o teste de exemplo e compara pela regra da D-27.
# A comparação espelha pipeline/bughunter_pipeline/comparacao.py e é testada
# contra os mesmos casos de referência (pipeline/tests/dados/comparacao.json).
# Como no executor do pipeline, o valor obtido passa por JSON antes de comparar
# (uma tupla vira lista), para Precheck e Verificar julgarem igual.

import json
import math

TOLERANCIA_RELATIVA = 1e-9


def _numero(valor):
    return isinstance(valor, (int, float)) and not isinstance(valor, bool)


def iguais(obtido, esperado):
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


def executar_exemplo(codigo, funcao, entrada_json, esperado_json):
    """Devolve JSON com resultado (passou | falhou | erro) e o obtido como o Python mostra."""
    escopo = {"__name__": "exercicio"}
    try:
        exec(compile(codigo, "exercicio.py", "exec"), escopo)
        alvo = escopo[funcao]
    except KeyError:
        return json.dumps({"resultado": "erro", "erro": f"a função {funcao} não está definida"})
    except Exception as e:
        return json.dumps({"resultado": "erro", "erro": f"{type(e).__name__}: {e}"[:300]})
    try:
        valor = alvo(*json.loads(entrada_json))
    except Exception as e:
        return json.dumps({"resultado": "erro", "erro": f"{type(e).__name__}: {e}"[:300]})
    try:
        comparavel = json.loads(json.dumps(valor))
    except (TypeError, ValueError):
        return json.dumps({"resultado": "erro", "erro": f"a função devolveu um valor que não pode ser comparado: {type(valor).__name__}"})
    ok = iguais(comparavel, json.loads(esperado_json))
    return json.dumps({"resultado": "passou" if ok else "falhou", "obtido": repr(valor)})

"""Os quatro mutadores (Documentação do Projeto §6.2, S1-09).

Cada categoria tem uma função que lista seus nós elegíveis em ordem de código-fonte
(percurso em profundidade). A contagem de ocorrências e a mutação usam a mesma
lista, então o parâmetro `alvo` (1-indexado) é estável entre execuções — condição
para a idempotência dos identificadores (D-19, RNF-08).
"""

import ast

CATEGORIAS = ("CMP_INV", "ARIT_TROC", "LACO_DESL", "ACUM_AUSENTE")

TROCA_COMPARADOR = {ast.Lt: ast.LtE, ast.LtE: ast.Lt, ast.Gt: ast.GtE, ast.GtE: ast.Gt}
TROCA_ARITMETICA = {ast.Add: ast.Sub, ast.Sub: ast.Add, ast.Mult: ast.Div, ast.Div: ast.Mult}
LACOS = (ast.For, ast.While)


class AlvoInvalido(Exception):
    pass


def _em_ordem(no, dentro_de_laco=False):
    """Percorre a árvore em profundidade, na ordem do código, indicando se o nó está num laço."""
    yield no, dentro_de_laco
    filhos_em_laco = dentro_de_laco or isinstance(no, LACOS)
    for filho in ast.iter_child_nodes(no):
        yield from _em_ordem(filho, filhos_em_laco)


def _eh_range(no) -> bool:
    return (isinstance(no, ast.Call) and isinstance(no.func, ast.Name) and no.func.id == "range"
            and 1 <= len(no.args) <= 3 and not no.keywords
            and not any(isinstance(a, ast.Starred) for a in no.args))


def elegiveis(arvore: ast.AST, categoria: str) -> list[ast.AST]:
    nos = []
    for no, em_laco in _em_ordem(arvore):
        if categoria == "CMP_INV":
            ok = isinstance(no, ast.Compare) and type(no.ops[0]) in TROCA_COMPARADOR
        elif categoria == "ARIT_TROC":  # BinOp e AugAssign numa travessia única (D-19)
            ok = isinstance(no, (ast.BinOp, ast.AugAssign)) and type(no.op) in TROCA_ARITMETICA
        elif categoria == "LACO_DESL":
            ok = _eh_range(no)
        elif categoria == "ACUM_AUSENTE":
            ok = em_laco and isinstance(no, (ast.AugAssign, ast.Assign))
        else:
            raise ValueError(f"categoria desconhecida: {categoria}")
        if ok:
            nos.append(no)
    return nos


def conta_ocorrencias(fonte: str, categoria: str) -> int:
    return len(elegiveis(ast.parse(fonte), categoria))


def _menos_um(expr: ast.expr) -> ast.expr:
    """Subtrai 1 do limite (D-18). Constantes e somas/subtrações com inteiro são
    recalculadas, para o código não denunciar a mutação com `-1 - 1` ou `n - 1 - 1`."""
    try:
        valor = ast.literal_eval(expr)
    except (ValueError, TypeError, SyntaxError):
        valor = None
    if isinstance(valor, int) and not isinstance(valor, bool):
        return ast.Constant(valor - 1)
    if (isinstance(expr, ast.BinOp) and isinstance(expr.op, (ast.Add, ast.Sub))
            and isinstance(expr.right, ast.Constant) and type(expr.right.value) is int):
        k = expr.right.value if isinstance(expr.op, ast.Add) else -expr.right.value
        k -= 1
        if k == 0:
            return expr.left
        return ast.BinOp(expr.left, ast.Add() if k > 0 else ast.Sub(), ast.Constant(abs(k)))
    return ast.BinOp(expr, ast.Sub(), ast.Constant(1))


def _remover(arvore: ast.AST, alvo_no: ast.AST) -> None:
    for pai in ast.walk(arvore):
        for campo in ("body", "orelse", "finalbody"):
            lista = getattr(pai, campo, None)
            if isinstance(lista, list) and any(item is alvo_no for item in lista):
                lista[:] = [item for item in lista if item is not alvo_no]
                return
    raise AssertionError("nó a remover não encontrado")


def mutar(fonte: str, categoria: str, alvo: int) -> str:
    """Aplica a mutação da categoria ao `alvo`-ésimo nó elegível e devolve o código (ast.unparse)."""
    arvore = ast.parse(fonte)
    nos = elegiveis(arvore, categoria)
    if not 1 <= alvo <= len(nos):
        raise AlvoInvalido(f"{categoria}: alvo {alvo} fora de 1..{len(nos)}")
    no = nos[alvo - 1]
    if categoria == "CMP_INV":
        no.ops[0] = TROCA_COMPARADOR[type(no.ops[0])]()
    elif categoria == "ARIT_TROC":
        no.op = TROCA_ARITMETICA[type(no.op)]()
    elif categoria == "LACO_DESL":
        indice = 0 if len(no.args) == 1 else 1  # o `stop`; o passo nunca é tocado (D-18)
        no.args[indice] = _menos_um(no.args[indice])
    elif categoria == "ACUM_AUSENTE":
        _remover(arvore, no)
    return ast.unparse(ast.fix_missing_locations(arvore))

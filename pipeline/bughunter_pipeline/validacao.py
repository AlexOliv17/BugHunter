"""Critérios de validade e cálculo de linha_defeito (Documentação do Projeto §6.1 e §6.3, S1-10).

Critérios (após a D-12): (1) difere do canônico, (2) compila, (3) falha em ao menos
um caso da suíte oculta, (4) exatamente um nó da árvore foi alterado.

linha_defeito é a verdade fundamental do diagnóstico. Ela é calculada por dois
caminhos independentes, sempre sobre a forma canônica, nunca sobre o texto-fonte:
  - texto: primeira linha em que o candidato diverge do canônico (§6.1);
  - árvore: linha, no canônico, do nó que o mutador alterou.
Para ACUM_AUSENTE, os dois caminhos apontam a linha imediatamente anterior ao ponto
da remoção (§6.3). Se os caminhos discordarem, o pipeline para (ErroDeLinha).
"""

import ast
from dataclasses import dataclass

from .conteudo import ProgramaBase
from .executor import executar_suite
from .mutadores import elegiveis, mutar


class ErroDeLinha(Exception):
    """Os dois cálculos de linha_defeito discordam: não se escolhe um deles."""


@dataclass
class Candidato:
    programa: ProgramaBase
    categoria: str
    ocorrencia: int
    codigo: str
    valido: bool
    motivo: str = ""              # por que foi descartado
    linha_defeito: int | None = None
    passados: int = 0
    total: int = 0
    passa_no_exemplo: bool = False


def primeira_linha_divergente(canonico: str, candidato: str) -> int:
    """Número (1-indexado) da primeira linha diferente. Se um texto é prefixo do
    outro, é a primeira linha que só existe no maior."""
    a, b = canonico.splitlines(), candidato.splitlines()
    for i, (x, y) in enumerate(zip(a, b), start=1):
        if x != y:
            return i
    if len(a) == len(b):
        raise ValueError("os códigos são iguais")
    return min(len(a), len(b)) + 1


def _campos(no: ast.AST):
    return [(nome, getattr(no, nome, None)) for nome in no._fields]


def nos_alterados(a, b) -> int:
    """Conta os pontos em que duas árvores diferem. Uma subárvore trocada conta 1;
    um item a mais ou a menos numa lista de comandos conta 1."""
    if isinstance(a, list) and isinstance(b, list):
        if len(a) == len(b):
            return sum(nos_alterados(x, y) for x, y in zip(a, b))
        if abs(len(a) - len(b)) == 1:
            maior, menor = (a, b) if len(a) > len(b) else (b, a)
            for i in range(len(maior)):
                if all(nos_alterados(x, y) == 0 for x, y in zip(maior[:i] + maior[i + 1:], menor)):
                    return 1
        return 1 + max(len(a), len(b))  # diferença grande: certamente mais de um nó
    if isinstance(a, ast.AST) and isinstance(b, ast.AST):
        if type(a) is not type(b):
            return 1
        return sum(nos_alterados(x, y) for (_, x), (_, y) in zip(_campos(a), _campos(b)))
    return 0 if a == b else 1


def linha_pela_arvore(canonico: str, categoria: str, ocorrencia: int) -> int:
    no = elegiveis(ast.parse(canonico), categoria)[ocorrencia - 1]
    if categoria == "ACUM_AUSENTE":
        return no.lineno - 1
    if categoria == "CMP_INV":
        return no.left.end_lineno  # o operador vem logo depois do lado esquerdo
    if categoria == "ARIT_TROC":
        return (no.left if isinstance(no, ast.BinOp) else no.target).end_lineno
    return no.args[0 if len(no.args) == 1 else 1].lineno  # LACO_DESL: o stop


def linha_pelo_texto(canonico: str, candidato: str, categoria: str) -> int:
    linha = primeira_linha_divergente(canonico, candidato)
    return linha - 1 if categoria == "ACUM_AUSENTE" else linha


def avaliar(programa: ProgramaBase, categoria: str, ocorrencia: int) -> Candidato:
    canonico = programa.codigo_correto
    codigo = mutar(canonico, categoria, ocorrencia)
    c = Candidato(programa, categoria, ocorrencia, codigo, valido=False)

    if codigo == canonico:                                           # critério 1
        c.motivo = "mutação sem efeito"
        return c
    try:                                                             # critério 2
        compile(codigo, "exercicio.py", "exec")
    except SyntaxError:
        c.motivo = "não compila"
        return c
    alterados = nos_alterados(ast.parse(canonico), ast.parse(codigo))
    if alterados != 1:                                               # critério 4
        c.motivo = f"altera {alterados} nós"
        return c
    suite = executar_suite(codigo, programa.nome_funcao, programa.suite_oculta)
    c.passados, c.total = suite.passados, suite.total
    if suite.resultado == "passou":                                  # critério 3
        c.motivo = "inócua: passa em toda a suíte oculta"
        return c

    pelo_texto = linha_pelo_texto(canonico, codigo, categoria)
    pela_arvore = linha_pela_arvore(canonico, categoria, ocorrencia)
    if pelo_texto != pela_arvore:
        raise ErroDeLinha(f"{programa.nome_funcao} {categoria} #{ocorrencia}: "
                          f"linha pelo texto {pelo_texto}, pela árvore {pela_arvore}")
    if not 1 <= pelo_texto <= len(codigo.splitlines()):              # Modelo §4.1
        raise ErroDeLinha(f"{programa.nome_funcao} {categoria} #{ocorrencia}: "
                          f"linha {pelo_texto} fora do código mutado")

    c.valido, c.linha_defeito = True, pelo_texto
    exemplo = executar_suite(codigo, programa.nome_funcao, [programa.teste_exemplo])
    c.passa_no_exemplo = exemplo.resultado == "passou"
    return c


def avaliar_programa(programa: ProgramaBase) -> list[Candidato]:
    candidatos = []
    for categoria in programa.categorias:
        for ocorrencia in range(1, len(elegiveis(ast.parse(programa.codigo_correto), categoria)) + 1):
            candidatos.append(avaliar(programa, categoria, ocorrencia))
    return candidatos

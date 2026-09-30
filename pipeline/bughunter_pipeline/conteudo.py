"""Carregador do conteúdo do repositório privado (D-22): programas-base e dicas."""

import ast
import json
import uuid
from dataclasses import dataclass
from pathlib import Path

from .executor import executar_suite

# Namespace fixo dos uuid5: mudar este valor muda todos os identificadores.
NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "https://github.com/AlexOliv17/BugHunter")

CATEGORIAS = ("CMP_INV", "ARIT_TROC", "LACO_DESL", "ACUM_AUSENTE")
CAMPOS = ("tema_codigo", "nome_funcao", "assinatura", "descricao", "codigo",
          "categorias", "teste_exemplo", "suite_oculta")


class ConteudoInvalido(Exception):
    pass


@dataclass(frozen=True)
class ProgramaBase:
    id: uuid.UUID
    tema_codigo: str
    nome_funcao: str
    assinatura: str
    descricao: str
    codigo_correto: str      # forma canônica: ast.unparse(ast.parse(fonte))
    categorias: tuple[str, ...]
    teste_exemplo: dict
    suite_oculta: list[dict]
    arquivo: str

    def linha_banco(self) -> dict:
        return {
            "id": str(self.id), "tema_codigo": self.tema_codigo, "nome_funcao": self.nome_funcao,
            "assinatura": self.assinatura, "descricao": self.descricao,
            "codigo_correto": self.codigo_correto, "teste_exemplo": self.teste_exemplo,
            "suite_oculta": json.dumps(self.suite_oculta, ensure_ascii=False),
        }


def canonico(fonte: str) -> str:
    return ast.unparse(ast.parse(fonte))


def id_programa(tema_codigo: str, nome_funcao: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"programa|{tema_codigo}|{nome_funcao}")


def _validar_caso(caso, onde: str):
    if not isinstance(caso, dict) or set(caso) - {"entrada", "esperado", "chamada"} or "entrada" not in caso or "esperado" not in caso:
        raise ConteudoInvalido(f"{onde}: caso precisa de 'entrada' e 'esperado'")
    if not isinstance(caso["entrada"], list):
        raise ConteudoInvalido(f"{onde}: 'entrada' é a lista de argumentos da chamada")


def carregar_programa(arquivo: Path) -> ProgramaBase:
    try:
        dados = json.loads(arquivo.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ConteudoInvalido(f"{arquivo.name}: JSON inválido ({e})") from e
    faltando = [c for c in CAMPOS if c not in dados]
    if faltando:
        raise ConteudoInvalido(f"{arquivo.name}: campos ausentes: {', '.join(faltando)}")

    nome = dados["nome_funcao"]
    try:
        codigo = canonico(dados["codigo"])
    except SyntaxError as e:
        raise ConteudoInvalido(f"{arquivo.name}: código não compila ({e})") from e
    definidas = [n.name for n in ast.parse(codigo).body if isinstance(n, ast.FunctionDef)]
    if definidas != [nome]:
        raise ConteudoInvalido(f"{arquivo.name}: o código deve definir só a função {nome}; define {definidas}")

    categorias = tuple(dados["categorias"])
    invalidas = [c for c in categorias if c not in CATEGORIAS]
    if not categorias or invalidas:
        raise ConteudoInvalido(f"{arquivo.name}: categorias inválidas: {invalidas or 'nenhuma'}")

    exemplo = dados["teste_exemplo"]
    _validar_caso(exemplo, f"{arquivo.name} teste_exemplo")
    if not isinstance(exemplo.get("chamada"), str):
        raise ConteudoInvalido(f"{arquivo.name}: teste_exemplo precisa de 'chamada' (texto exibido)")
    suite = dados["suite_oculta"]
    if not isinstance(suite, list) or not suite:
        raise ConteudoInvalido(f"{arquivo.name}: suite_oculta deve ser uma lista não vazia de casos")
    for i, caso in enumerate(suite):
        _validar_caso(caso, f"{arquivo.name} suite_oculta[{i}]")

    # regras de autoria (Documentação §6.3): o correto passa em tudo, e a suíte
    # tem ao menos um caso de borda fora do exemplo
    for rotulo, casos in (("teste_exemplo", [exemplo]), ("suite_oculta", suite)):
        r = executar_suite(codigo, nome, casos)
        if r.resultado != "passou":
            raise ConteudoInvalido(f"{arquivo.name}: o código correto não passa em {rotulo} "
                                   f"({r.resultado}, casos com falha: {r.falhas})")
    if all(caso["entrada"] == exemplo["entrada"] for caso in suite):
        raise ConteudoInvalido(f"{arquivo.name}: a suíte oculta precisa de ao menos um caso fora do exemplo")

    return ProgramaBase(
        id=id_programa(dados["tema_codigo"], nome), tema_codigo=dados["tema_codigo"],
        nome_funcao=nome, assinatura=dados["assinatura"], descricao=dados["descricao"],
        codigo_correto=codigo, categorias=categorias,
        teste_exemplo={"chamada": exemplo["chamada"], "entrada": exemplo["entrada"], "esperado": exemplo["esperado"],
                       # texto como o Python mostra: o JSON não distingue 8.0 de 8 na tela
                       "entrada_repr": ", ".join(repr(a) for a in exemplo["entrada"]),
                       "esperado_repr": repr(exemplo["esperado"])},
        suite_oculta=[{"entrada": c["entrada"], "esperado": c["esperado"]} for c in suite],
        arquivo=arquivo.name,
    )


def carregar_programas(conteudo_dir: Path) -> list[ProgramaBase]:
    arquivos = sorted((conteudo_dir / "programas_base").glob("*.json"))
    programas = [carregar_programa(a) for a in arquivos]
    vistos = set()
    for p in programas:
        chave = (p.tema_codigo, p.nome_funcao)
        if chave in vistos:
            raise ConteudoInvalido(f"programa-base repetido: {chave}")
        vistos.add(chave)
    return programas


def carregar_dicas(conteudo_dir: Path) -> list[dict]:
    """Devolve as 12 linhas de dicas, validando exatamente 3 níveis por categoria (Modelo §4.1)."""
    dados = json.loads((conteudo_dir / "dicas" / "dicas.json").read_text(encoding="utf-8"))
    categorias = {k: v for k, v in dados.items() if not k.startswith("_")}
    if set(categorias) != set(CATEGORIAS):
        raise ConteudoInvalido(f"dicas.json: categorias esperadas {CATEGORIAS}, encontradas {sorted(categorias)}")
    linhas = []
    for codigo, niveis in categorias.items():
        if set(niveis) != {"1", "2", "3"}:
            raise ConteudoInvalido(f"dicas.json: {codigo} precisa exatamente dos níveis 1, 2 e 3")
        for nivel, texto in niveis.items():
            if not isinstance(texto, str) or not texto.strip():
                raise ConteudoInvalido(f"dicas.json: {codigo} nível {nivel} vazio")
            linhas.append({"categoria_codigo": codigo, "nivel_dica": int(nivel), "texto": texto.strip()})
    return linhas

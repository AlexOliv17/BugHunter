"""Leitura de pipeline/.env e validação de CONTEUDO_DIR."""

from dataclasses import dataclass
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent.parent
REPO_PUBLICO = PIPELINE_DIR.parent


class ErroDeConfiguracao(Exception):
    pass


@dataclass(frozen=True)
class Config:
    supabase_url: str
    chave_servico: str
    conteudo_dir: Path


def ler_env(caminho: Path) -> dict[str, str]:
    valores = {}
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        nome, valor = linha.split("=", 1)
        valores[nome.strip()] = valor.strip()
    return valores


def validar_conteudo_dir(bruto: str, base: Path = PIPELINE_DIR) -> Path:
    """Resolve CONTEUDO_DIR e recusa uma pasta dentro do repositório público (D-22)."""
    if not bruto:
        raise ErroDeConfiguracao("CONTEUDO_DIR não definido em pipeline/.env")
    caminho = (base / bruto).resolve()
    if not caminho.is_dir():
        raise ErroDeConfiguracao(f"CONTEUDO_DIR não existe: {caminho}")
    if caminho == REPO_PUBLICO or REPO_PUBLICO in caminho.parents:
        raise ErroDeConfiguracao(
            "CONTEUDO_DIR aponta para dentro do repositório público; "
            "o conteúdo precisa ficar no repositório privado (D-22)"
        )
    return caminho


def carregar_config(caminho_env: Path = PIPELINE_DIR / ".env") -> Config:
    if not caminho_env.is_file():
        raise ErroDeConfiguracao(f"arquivo não encontrado: {caminho_env}")
    env = ler_env(caminho_env)
    faltando = [n for n in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") if not env.get(n)]
    if faltando:
        raise ErroDeConfiguracao(f"variáveis ausentes em pipeline/.env: {', '.join(faltando)}")
    return Config(
        supabase_url=env["SUPABASE_URL"].rstrip("/"),
        chave_servico=env["SUPABASE_SERVICE_ROLE_KEY"],
        conteudo_dir=validar_conteudo_dir(env.get("CONTEUDO_DIR", "")),
    )

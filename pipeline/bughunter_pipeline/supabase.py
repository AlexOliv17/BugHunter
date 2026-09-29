"""Gravação no Supabase pela API REST, com a chave de serviço (somente no pipeline)."""

import json
import urllib.error
import urllib.request

from .config import Config


class ErroSupabase(Exception):
    pass


class Supabase:
    def __init__(self, config: Config):
        self._base = f"{config.supabase_url}/rest/v1"
        self._cabecalhos = {"apikey": config.chave_servico, "Content-Type": "application/json"}
        if config.chave_servico.startswith("eyJ"):  # chave legada em formato JWT
            self._cabecalhos["Authorization"] = f"Bearer {config.chave_servico}"

    def _pedir(self, metodo: str, caminho: str, corpo=None, extra: dict | None = None):
        dados = None if corpo is None else json.dumps(corpo, ensure_ascii=False).encode("utf-8")
        pedido = urllib.request.Request(f"{self._base}/{caminho}", data=dados, method=metodo,
                                        headers={**self._cabecalhos, **(extra or {})})
        try:
            with urllib.request.urlopen(pedido, timeout=30) as resposta:
                texto = resposta.read().decode("utf-8")
                return json.loads(texto) if texto else None
        except urllib.error.HTTPError as e:
            # a mensagem do PostgREST não contém a chave; o cabeçalho não é repetido
            raise ErroSupabase(f"{metodo} {caminho}: HTTP {e.code} {e.read().decode('utf-8')[:300]}") from None

    def upsert(self, tabela: str, linhas: list[dict], conflito: str) -> int:
        """Insere ou atualiza pelas colunas de `conflito`; rodar duas vezes não duplica (RNF-08)."""
        if not linhas:
            return 0
        self._pedir("POST", f"{tabela}?on_conflict={conflito}", linhas,
                    {"Prefer": "resolution=merge-duplicates,return=minimal"})
        return len(linhas)

    def atualizar(self, tabela: str, filtro: str, valores: dict) -> int:
        """Atualiza as linhas que casam com o filtro PostgREST; devolve quantas mudaram."""
        linhas = self._pedir("PATCH", f"{tabela}?{filtro}", valores, {"Prefer": "return=representation"})
        return len(linhas or [])

    def selecionar(self, tabela: str, colunas: str = "*", filtro: str = "") -> list[dict]:
        return self._pedir("GET", f"{tabela}?select={colunas}{'&' + filtro if filtro else ''}")

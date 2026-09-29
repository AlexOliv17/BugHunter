"""Carga idempotente dos exercícios (S1-11, RNF-08, D-20, D-21).

- id: uuid5 da chave natural programa|categoria|ocorrência|versão do mutador (§6.1);
- ordem: permutação pseudoaleatória com semente fixa, dentro de cada nível (D-20);
  os níveis ocupam faixas consecutivas (baixo primeiro), para a ordem ser única
  entre os ativos (índice idx_exercicios_ordem_ativa);
- exercícios que não saíram desta geração são desativados, nunca apagados (D-21).
"""

import random
import uuid

from . import MUTADOR_VERSAO
from .conteudo import NAMESPACE
from .validacao import Candidato

NIVEIS = ("baixo", "medio")
SEMENTE_ORDEM = f"bughunter-ordem|{MUTADOR_VERSAO}"


def id_exercicio(c: Candidato) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"{c.programa.id}|{c.categoria}|{c.ocorrencia}|{MUTADOR_VERSAO}")


def montar_linhas(validos: list[Candidato], nivel_da_categoria: dict[str, str]) -> list[dict]:
    """Linhas de `exercicios` com ordem atribuída. Mesma entrada, mesma saída."""
    desconhecidas = {c.categoria for c in validos} - set(nivel_da_categoria)
    if desconhecidas:
        raise ValueError(f"categorias sem nível no banco: {desconhecidas}")
    linhas, proxima = [], 1
    for nivel in NIVEIS:
        do_nivel = sorted((c for c in validos if nivel_da_categoria[c.categoria] == nivel),
                          key=lambda c: str(id_exercicio(c)))  # ponto de partida estável
        random.Random(f"{SEMENTE_ORDEM}|{nivel}").shuffle(do_nivel)
        for c in do_nivel:
            linhas.append({
                "id": str(id_exercicio(c)), "programa_base_id": str(c.programa.id),
                "categoria_codigo": c.categoria, "ordem": proxima,
                "codigo_com_defeito": c.codigo, "linha_defeito": c.linha_defeito,
                "mutador_versao": MUTADOR_VERSAO, "ativo": True,
            })
            proxima += 1
    return linhas


def carregar_exercicios(banco, linhas: list[dict]) -> dict:
    ids = [l["id"] for l in linhas]
    # 1. desativa o que não saiu desta geração (versões antigas incluídas) — D-21
    filtro_fora = f"ativo=eq.true&id=not.in.({','.join(ids)})" if ids else "ativo=eq.true"
    desativados = banco.atualizar("exercicios", filtro_fora, {"ativo": False})
    # 2. grava com ordem negativa (livre no índice único), 3. troca para a definitiva
    banco.upsert("exercicios", [{**l, "ordem": -l["ordem"]} for l in linhas], "id")
    banco.upsert("exercicios", linhas, "id")
    return {"gravados": len(linhas), "desativados": desativados}

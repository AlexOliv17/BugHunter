"""Linha de comando do pipeline.

    python -m bughunter_pipeline validar     valida o conteúdo, sem tocar no banco
    python -m bughunter_pipeline dicas       carrega as 12 dicas e confere 3 por categoria
    python -m bughunter_pipeline programas   carrega os programas-base
    python -m bughunter_pipeline gerar       avalia os candidatos a exercício, sem gravar
    python -m bughunter_pipeline carregar    grava programas-base e exercícios (idempotente)
"""

import sys
from collections import Counter

from .config import ErroDeConfiguracao, carregar_config
from .conteudo import ConteudoInvalido, carregar_dicas, carregar_programas
from .supabase import ErroSupabase, Supabase
from .carga import carregar_exercicios, montar_linhas
from .validacao import ErroDeLinha, avaliar_programa


def validar(config) -> None:
    programas = carregar_programas(config.conteudo_dir)
    dicas = carregar_dicas(config.conteudo_dir)
    print(f"conteúdo válido: {len(programas)} programa(s)-base, {len(dicas)} dicas")
    for p in programas:
        print(f"  {p.nome_funcao}: {len(p.suite_oculta)} casos na suíte, categorias {', '.join(p.categorias)}")


def dicas(config) -> None:
    banco = Supabase(config)
    n = banco.upsert("dicas", carregar_dicas(config.conteudo_dir), "categoria_codigo,nivel_dica")
    # teste de integridade do Modelo §4.1: exatamente três dicas por categoria
    categorias = [c["codigo"] for c in banco.selecionar("categorias_defeito", "codigo")]
    contagem = Counter(d["categoria_codigo"] for d in banco.selecionar("dicas", "categoria_codigo"))
    fora = {c: contagem.get(c, 0) for c in categorias if contagem.get(c, 0) != 3}
    if fora:
        raise ConteudoInvalido(f"categorias sem exatamente 3 dicas no banco: {fora}")
    print(f"{n} dicas gravadas; {len(categorias)} categorias com exatamente 3 dicas cada")


def programas(config) -> None:
    lista = carregar_programas(config.conteudo_dir)
    n = Supabase(config).upsert("programas_base", [p.linha_banco() for p in lista], "id")
    print(f"{n} programa(s)-base gravado(s)")


def gerar(config) -> None:
    validos = []
    for p in carregar_programas(config.conteudo_dir):
        for c in avaliar_programa(p):
            if c.valido:
                validos.append(c)
                exemplo = "passa no exemplo" if c.passa_no_exemplo else "quebra o exemplo"
                print(f"  válido     {p.nome_funcao:16} {c.categoria:12} #{c.ocorrencia}  "
                      f"linha {c.linha_defeito}  suíte {c.passados}/{c.total}  {exemplo}")
            else:
                print(f"  descartado {p.nome_funcao:16} {c.categoria:12} #{c.ocorrencia}  {c.motivo}")
    so_na_borda = sum(c.passa_no_exemplo for c in validos)
    print(f"{len(validos)} exercícios válidos; {so_na_borda} passam no exemplo e só falham na borda")


def carregar(config) -> None:
    banco = Supabase(config)
    lista = carregar_programas(config.conteudo_dir)
    validos = [c for p in lista for c in avaliar_programa(p) if c.valido]
    niveis = {c["codigo"]: c["nivel"] for c in banco.selecionar("categorias_defeito", "codigo,nivel")}
    linhas = montar_linhas(validos, niveis)
    banco.upsert("programas_base", [p.linha_banco() for p in lista], "id")
    r = carregar_exercicios(banco, linhas)
    ativos = banco.selecionar("exercicios", "id", "ativo=eq.true")
    print(f"{len(lista)} programas-base; {r['gravados']} exercícios gravados, "
          f"{r['desativados']} desativados; {len(ativos)} ativos no banco")


COMANDOS = {"validar": validar, "dicas": dicas, "programas": programas, "gerar": gerar, "carregar": carregar}


def main(argv: list[str]) -> int:
    for fluxo in (sys.stdout, sys.stderr):
        fluxo.reconfigure(encoding="utf-8")  # o console do Windows não usa UTF-8 por padrão
    if len(argv) != 1 or argv[0] not in COMANDOS:
        print(__doc__)
        return 2
    try:
        COMANDOS[argv[0]](carregar_config())
    except (ErroDeConfiguracao, ConteudoInvalido, ErroSupabase, ErroDeLinha) as e:
        print(f"erro: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

"""Teste de isolamento do executor publicado (S4-07, RF-11, RNF-05).

Submete ao executor códigos de aluno que tentam ler o ambiente, escrever arquivos,
esgotar a memória e travar em laço, e confere que nada disso funciona nem derruba
o serviço. As sondas devolvem só contagens e sim/não; nenhum valor de variável é
lido nem impresso.

    python executor/tests/isolamento_remoto.py https://bughunter-executor.vercel.app/api/executar

O segredo vem de EXECUTOR_SEGREDO no ambiente (ou de app/.env.local). Em
servidor local no Windows, use --sem-memoria: lá não existem os limites do
sistema operacional, e a sonda de memória tomaria a RAM da máquina.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]


def segredo():
    if os.environ.get("EXECUTOR_SEGREDO"):
        return os.environ["EXECUTOR_SEGREDO"]
    env_local = RAIZ / "app" / ".env.local"
    if env_local.exists():
        achado = re.search(r"^EXECUTOR_SEGREDO=(.+)$", env_local.read_text(encoding="utf-8"), re.M)
        if achado:
            return achado.group(1).strip()
    sys.exit("defina EXECUTOR_SEGREDO")


def chamar(url, chave, codigo, entradas=([],)):
    corpo = json.dumps({
        "codigo": codigo, "funcao": "f",
        "entradas": [{"t": "list", "v": [{"t": "int", "v": str(x)} for x in e]} for e in entradas],
    }).encode()
    pedido = urllib.request.Request(url, data=corpo, method="POST", headers={
        "content-type": "application/json", "authorization": f"Bearer {chave}"})
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(pedido, timeout=30) as r:
            return r.status, json.loads(r.read()), time.perf_counter() - t0
    except urllib.error.HTTPError as e:
        return e.code, None, time.perf_counter() - t0


def valor(resposta):
    """Primeiro valor devolvido, decodificado do fio (só dict de bool/int aqui)."""
    try:
        fio = resposta["resultados"][0]["valor"]
    except (TypeError, KeyError, IndexError):
        return None
    if fio["t"] == "dict":
        return {k: (v["v"] if v["t"] == "bool" else int(v["v"])) for k, v in fio["v"].items()}
    return fio


# ─────────────────────────── sondas ───────────────────────────
# Cada uma devolve um dicionário de sim/não e contagens.

AMBIENTE = r'''
import os
def f():
    nomes = list(os.environ)
    return {
        "variaveis_no_filho": len(nomes),
        "nome_suspeito_no_filho": any(p in n.upper() for n in nomes
                                      for p in ("SUPABASE", "FEEDBACK", "GEMINI", "SECRET", "SEGREDO", "KEY", "TOKEN")),
        # só a permissão de leitura; o conteúdo não é aberto
        "environ_do_pai_legivel": os.access(f"/proc/{os.getppid()}/environ", os.R_OK),
    }
'''

ARQUIVOS = r'''
import os, tempfile
def tenta(caminho, tamanho=1):
    try:
        with open(caminho, "w") as f:
            f.write("x" * tamanho)
        os.remove(caminho)
        return True
    except Exception:
        return False
def f():
    return {
        "escreve_na_pasta_propria": tenta("sonda.txt"),
        "escreve_no_codigo_da_funcao": tenta("/var/task/sonda_bh.txt"),
        "escreve_na_raiz": tenta("/sonda_bh.txt"),
        "escreve_em_tmp": tenta(os.path.join(tempfile.gettempdir(), "sonda_bh.txt")),
        "escreve_arquivo_de_2mb": tenta("grande.txt", 2 * 1024 * 1024),
    }
'''

MEMORIA = r'''
def f():
    blocos = []
    while True:
        blocos.append(bytearray(50 * 1024 * 1024))
'''

LACO = r'''
def f():
    while True:
        pass
'''

NETOS = r'''
import subprocess, sys
def f():
    # tenta deixar um processo vivo depois do fim da execução
    subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    return {"criou_processo": True}
'''

NORMAL = "def f(x):\n    return x * 2\n"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--sem-memoria", action="store_true")
    args = ap.parse_args()
    chave = segredo()
    linhas = []

    def registrar(sonda, observado, esperado, ok):
        linhas.append((sonda, observado, esperado, "ok" if ok else "ALERTA"))

    st, r, _ = chamar(args.url, "segredo-errado", NORMAL, ([3],))
    registrar("segredo errado", f"HTTP {st}", "HTTP 401", st == 401)

    st, r, _ = chamar(args.url, chave, NORMAL, ([3],))
    registrar("chamada normal", valor(r), "int 6", st == 200 and valor(r) == {"t": "int", "v": "6"})

    st, r, _ = chamar(args.url, chave, AMBIENTE)
    v = valor(r) or {}
    registrar("variáveis no processo do aluno", v.get("variaveis_no_filho"), "0", v.get("variaveis_no_filho") == 0)
    registrar("nome suspeito no processo do aluno", v.get("nome_suspeito_no_filho"), "False", v.get("nome_suspeito_no_filho") is False)
    # conhecido desde a S0-04: o pai é legível; neste projeto ele só tem EXECUTOR_SEGREDO
    registrar("ambiente do pai legível", v.get("environ_do_pai_legivel"), "limitação conhecida", True)

    st, r, _ = chamar(args.url, chave, ARQUIVOS)
    v = valor(r) or {}
    registrar("escreve na pasta temporária própria", v.get("escreve_na_pasta_propria"), "True", v.get("escreve_na_pasta_propria") is True)
    registrar("escreve no código da função", v.get("escreve_no_codigo_da_funcao"), "False", v.get("escreve_no_codigo_da_funcao") is False)
    registrar("escreve na raiz", v.get("escreve_na_raiz"), "False", v.get("escreve_na_raiz") is False)
    registrar("escreve em /tmp da instância", v.get("escreve_em_tmp"), "informativo", True)
    registrar("escreve arquivo de 2 MB", v.get("escreve_arquivo_de_2mb"), "False (teto 1 MB)", v.get("escreve_arquivo_de_2mb") is False)

    if not args.sem_memoria:
        st, r, dt = chamar(args.url, chave, MEMORIA)
        registrar("esgotar memória", f"HTTP {st}, {r and r.get('situacao')}, {dt:.1f} s", "erro, sem derrubar",
                  st == 200 and r and r.get("situacao") in ("erro", "tempo_excedido"))
        st, r, _ = chamar(args.url, chave, NORMAL, ([3],))
        registrar("chamada normal depois da memória", valor(r), "int 6", st == 200 and valor(r) == {"t": "int", "v": "6"})

    st, r, dt = chamar(args.url, chave, LACO)
    registrar("laço infinito", f"{r and r.get('situacao')}, {dt:.1f} s", "tempo_excedido em ~5 s",
              st == 200 and r and r.get("situacao") == "tempo_excedido" and dt < 12)
    st, r, _ = chamar(args.url, chave, NORMAL, ([3],))
    registrar("chamada normal depois do laço", valor(r), "int 6", st == 200 and valor(r) == {"t": "int", "v": "6"})

    st, r, _ = chamar(args.url, chave, NETOS)
    registrar("processo que tenta sobreviver", r and r.get("situacao"), "ok (o grupo é encerrado no fim)", st == 200)

    largura = max(len(l[0]) for l in linhas)
    for sonda, observado, esperado, situacao in linhas:
        print(f"{situacao:6}  {sonda:<{largura}}  observado: {observado}  ·  esperado: {esperado}")
    alertas = sum(1 for l in linhas if l[3] != "ok")
    print(f"\n{len(linhas)} verificações, {alertas} alerta(s)")
    sys.exit(1 if alertas else 0)


if __name__ == "__main__":
    main()

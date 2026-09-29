"""Spike S0-04 — rota A: execução de código Python em subprocess na Vercel.

Código descartável: existe só para medir a rota A e será removido depois da
decisão da S0-07. Não aceita código enviado pelo cliente — roda apenas casos
fixos definidos aqui, para não expor execução arbitrária em produção. As
respostas trazem apenas contagens e booleanos, nunca valores de ambiente.

GET /api/spike_rota_a?caso=<nome>   (sem caso: lista os casos)
"""

import json
import os
import subprocess
import sys
import tempfile
import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

try:
    import resource  # só existe em Unix
except ImportError:  # pragma: no cover
    resource = None

_INICIO_INSTANCIA = time.time()
_CHAMADAS = 0
LIMITE_S = 5
MARCADOR = "__BUGHUNTER_RESULTADO__"

MEDIA_CORRETA = """
def media_das_notas(notas):
    soma = 0
    for n in notas:
        soma += n
    return soma / len(notas)
"""

TESTES_MEDIA = [
    ("media_das_notas([7, 8, 9])", 8.0),
    ("media_das_notas([10])", 10.0),
    ("media_das_notas([0, 5])", 2.5),
]

SONDA_ENV = """
import os, json
nomes = list(os.environ)
print(json.dumps({"qtd_variaveis": len(nomes),
                  "alguma_chave_sensivel": any(k in n for n in nomes for k in ("SUPABASE", "FEEDBACK", "KEY", "SECRET", "TOKEN"))}))
"""

SONDA_PROC = """
import os, json
alvos = {"pai": f"/proc/{os.getppid()}/environ", "pid1": "/proc/1/environ", "self": "/proc/self/environ"}
res = {}
for nome, caminho in alvos.items():
    try:
        dados = open(caminho, "rb").read()
        res[nome] = {"legivel": True, "contem_chave_de_servico": b"SUPABASE_SERVICE_ROLE_KEY" in dados,
                     "contem_chave_do_modelo": b"FEEDBACK_API_KEY" in dados}
    except Exception as e:
        res[nome] = {"legivel": False, "erro": type(e).__name__}
# varre todos os processos visíveis
achados = 0
for pid in os.listdir("/proc") if os.path.isdir("/proc") else []:
    if pid.isdigit():
        try:
            if b"SUPABASE_SERVICE_ROLE_KEY" in open(f"/proc/{pid}/environ", "rb").read():
                achados += 1
        except Exception:
            pass
res["processos_com_chave_visivel"] = achados
print(json.dumps(res))
"""

SONDA_ARQUIVO = """
import os, json, tempfile
res = {}
for nome, caminho in {"cwd": "teste.txt", "tmp": os.path.join(tempfile.gettempdir(), "bh_teste.txt"),
                      "var_task": "/var/task/bh_teste.txt", "raiz": "/bh_teste.txt", "home": os.path.expanduser("~/bh_teste.txt")}.items():
    try:
        with open(caminho, "w") as f:
            f.write("x")
        res[nome] = "escreveu"
    except Exception as e:
        res[nome] = "negado:" + type(e).__name__
print(json.dumps(res))
"""

CASOS = {
    "ok": ("suite", MEDIA_CORRETA),
    "falha": ("suite", MEDIA_CORRETA.replace("soma += n", "soma += 1")),
    "excecao": ("suite", MEDIA_CORRETA.replace("return soma / len(notas)", "return soma / 0")),
    "laco_infinito": ("suite", "def media_das_notas(notas):\n    while True:\n        pass\n"),
    "memoria": ("suite", "def media_das_notas(notas):\n    x = []\n    while True:\n        x.append(' ' * 10_000_000)\n"),
    "sonda_env": ("script", SONDA_ENV),
    "sonda_proc": ("script", SONDA_PROC),
    "sonda_arquivo": ("script", SONDA_ARQUIVO),
}


def _limites():
    if resource is None:
        return
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)   # memória
    resource.setrlimit(resource.RLIMIT_CPU, (LIMITE_S + 1,) * 2)       # CPU
    resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024,) * 2)      # arquivo gravado


def _script_suite(codigo):
    testes = json.dumps(TESTES_MEDIA)
    return f"""
import json
passados, total, erro = 0, 0, None
try:
    exec(compile({codigo!r}, "aluno.py", "exec"), globals())
    for chamada, esperado in json.loads({testes!r}):
        total += 1
        try:
            if eval(chamada) == esperado:
                passados += 1
        except Exception:
            pass
except Exception as e:
    erro = type(e).__name__
print({MARCADOR!r} + json.dumps({{"passados": passados, "total": {len(TESTES_MEDIA)}, "erro": erro}}))
"""


def executar(caso):
    tipo, codigo = CASOS[caso]
    fonte = _script_suite(codigo) if tipo == "suite" else codigo
    with tempfile.TemporaryDirectory() as pasta:
        arquivo = os.path.join(pasta, "executa.py")
        with open(arquivo, "w", encoding="utf-8") as f:
            f.write(fonte)
        t0 = time.perf_counter()
        try:
            proc = subprocess.run(
                [sys.executable, "-I", "-S", arquivo],
                env={}, cwd=pasta, capture_output=True, text=True,
                timeout=LIMITE_S, preexec_fn=_limites if resource else None,
            )
        except subprocess.TimeoutExpired:
            return {"resultado": "tempo_excedido", "tempo_ms": round((time.perf_counter() - t0) * 1000)}
        tempo_ms = round((time.perf_counter() - t0) * 1000)

    saida = {"tempo_ms": tempo_ms, "codigo_saida": proc.returncode}
    if tipo == "script":
        try:
            saida["sonda"] = json.loads(proc.stdout.strip().splitlines()[-1])
        except Exception:
            saida["sonda"] = None
            saida["stderr_ultima_linha"] = (proc.stderr.strip().splitlines() or [""])[-1][:200]
        return saida

    linha = next((l for l in proc.stdout.splitlines() if l.startswith(MARCADOR)), None)
    if linha is None:
        saida["resultado"] = "erro"
        saida["motivo"] = "processo encerrado sem resultado (sinal ou limite)" if proc.returncode else "sem saída"
        return saida
    r = json.loads(linha[len(MARCADOR):])
    saida.update(passados=r["passados"], total=r["total"])
    saida["resultado"] = "erro" if r["erro"] else ("passou" if r["passados"] == r["total"] else "falhou")
    return saida


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        global _CHAMADAS
        _CHAMADAS += 1
        caso = parse_qs(urlparse(self.path).query).get("caso", [None])[0]
        if caso is None:
            corpo, status = {"casos": list(CASOS)}, 200
        elif caso not in CASOS:
            corpo, status = {"erro": "caso desconhecido"}, 400
        else:
            corpo, status = {"caso": caso, **executar(caso)}, 200
        corpo["instancia"] = {
            "python": sys.version.split()[0],
            "chamada_nesta_instancia": _CHAMADAS,
            "idade_instancia_s": round(time.time() - _INICIO_INSTANCIA, 1),
        }
        dados = json.dumps(corpo).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(dados)

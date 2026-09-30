"""Executor do Verificar (S4-01, DA-08, RF-10, RF-11) — rota A'.

Roda num projeto Vercel separado, sem nenhuma credencial. A única variável de
ambiente é EXECUTOR_SEGREDO, que autentica o servidor Next.js.

POST /api/executar
  cabeçalho  Authorization: Bearer <EXECUTOR_SEGREDO>
  corpo      {"codigo", "funcao", "entradas": [<lista de argumentos em fio>, ...]}
  resposta   {"situacao": "ok" | "tempo_excedido" | "erro",
              "resultados": [{"valor": <fio>} | {"erro": "<tipo da exceção>"}, ...]}

O esperado nunca chega aqui: o executor devolve só os valores obtidos e a
comparação acontece no servidor Next.js (D-26). Assim, mesmo que o código do
aluno tome conta deste processo, não encontra nada além das entradas.

"Fio" é a representação JSON com o tipo explícito ({"t": "int", "v": "8"},
{"t": "float", "v": "8.0"}, ...). Sem ela, o JavaScript não distingue 8 de 8.0
nem guarda inteiros grandes, e a regra da D-27 depende dos dois.

O código do aluno roda num processo filho: env={}, pasta temporária própria,
python -I -S, limites de memória, CPU, tamanho de arquivo e arquivos abertos,
sessão própria (o grupo inteiro é encerrado no fim) e saída descartada. O
resultado volta por um arquivo, limitado pelo teto de tamanho.
"""

import hmac
import json
import os
import signal
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler

try:
    import resource  # só existe em Unix; na Vercel, sempre
except ImportError:  # pragma: no cover — desenvolvimento no Windows
    resource = None

LIMITE_S = 5                       # RN-03
MEMORIA_BYTES = 256 * 1024 * 1024
ARQUIVO_BYTES = 1024 * 1024        # teto de qualquer arquivo gravado, inclusive o resultado
MAX_CORPO = 256 * 1024
MAX_CODIGO = 20_000
MAX_CASOS = 100

# Roda no processo filho. Recebe o pedido pela entrada padrão e grava o resultado
# no arquivo indicado. Nenhuma exceção do aluno escapa: SystemExit também é pega.
_EXECUTA = r'''
import json, sys
destino = sys.argv[1]
pedido = json.loads(sys.stdin.read())
escopo = {"__name__": "exercicio"}
try:
    exec(compile(pedido["codigo"], "exercicio.py", "exec"), escopo)
    funcao = escopo[pedido["funcao"]]
    if not callable(funcao):
        raise TypeError("não é função")
except BaseException as e:
    saida = {"carregou": False, "erro": type(e).__name__}
else:
    resultados = []
    for argumentos in pedido["entradas"]:
        try:
            valor = funcao(*argumentos)
            resultados.append({"valor": json.loads(json.dumps(valor))})
        except BaseException as e:
            resultados.append({"erro": type(e).__name__})
    saida = {"carregou": True, "resultados": resultados}
with open(destino, "w", encoding="utf-8") as f:
    json.dump(saida, f)
'''


class PedidoInvalido(ValueError):
    pass


# ───────────────────────────── fio ─────────────────────────────

def codificar(valor):
    """Valor Python (já passado por JSON) -> fio."""
    if isinstance(valor, bool):
        return {"t": "bool", "v": valor}
    if isinstance(valor, int):
        return {"t": "int", "v": str(valor)}
    if isinstance(valor, float):
        return {"t": "float", "v": repr(valor)}
    if isinstance(valor, str):
        return {"t": "str", "v": valor}
    if valor is None:
        return {"t": "none"}
    if isinstance(valor, list):
        return {"t": "list", "v": [codificar(x) for x in valor]}
    if isinstance(valor, dict):
        return {"t": "dict", "v": {str(k): codificar(x) for k, x in valor.items()}}
    raise PedidoInvalido(f"tipo sem representação: {type(valor).__name__}")


def decodificar(fio):
    """Fio -> valor Python. Recusa qualquer coisa fora do formato."""
    if not isinstance(fio, dict) or not isinstance(fio.get("t"), str):
        raise PedidoInvalido("fio malformado")
    t, v = fio["t"], fio.get("v")
    if t == "bool" and isinstance(v, bool):
        return v
    if t == "int" and isinstance(v, str):
        return int(v)
    if t == "float" and isinstance(v, str):
        return float(v)
    if t == "str" and isinstance(v, str):
        return v
    if t == "none":
        return None
    if t == "list" and isinstance(v, list):
        return [decodificar(x) for x in v]
    if t == "dict" and isinstance(v, dict):
        return {k: decodificar(x) for k, x in v.items()}
    raise PedidoInvalido("fio malformado")


# ─────────────────────────── execução ───────────────────────────

def _limites():
    resource.setrlimit(resource.RLIMIT_AS, (MEMORIA_BYTES, MEMORIA_BYTES))
    resource.setrlimit(resource.RLIMIT_CPU, (LIMITE_S + 1, LIMITE_S + 1))
    resource.setrlimit(resource.RLIMIT_FSIZE, (ARQUIVO_BYTES, ARQUIVO_BYTES))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def _encerrar_grupo(proc):
    """Encerra o filho e tudo o que ele tiver criado (sessão própria)."""
    if hasattr(os, "killpg"):
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
    else:  # pragma: no cover — Windows
        proc.kill()


# Ambiente do filho: vazio. No Windows (só desenvolvimento local) o Python não
# inicia sem SYSTEMROOT; na Vercel é Linux e o ambiente fica realmente vazio.
_AMBIENTE_FILHO = {"SYSTEMROOT": os.environ.get("SYSTEMROOT", "")} if os.name == "nt" else {}


def executar(codigo, funcao, entradas, limite_s=LIMITE_S):
    """Roda o código do aluno sobre as entradas (valores Python). Nunca recebe o esperado."""
    pedido = json.dumps({"codigo": codigo, "funcao": funcao, "entradas": entradas})
    with tempfile.TemporaryDirectory(prefix="bh-", ignore_cleanup_errors=True) as pasta:
        script = os.path.join(pasta, "executa.py")
        destino = os.path.join(pasta, "resultado.json")
        with open(script, "w", encoding="utf-8") as f:
            f.write(_EXECUTA)
        proc = subprocess.Popen(
            [sys.executable, "-I", "-S", script, destino],
            stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env=_AMBIENTE_FILHO, cwd=pasta, text=True, encoding="utf-8",
            preexec_fn=_limites if resource else None,
            start_new_session=True,
        )
        try:
            proc.communicate(pedido, timeout=limite_s)
        except subprocess.TimeoutExpired:
            _encerrar_grupo(proc)
            proc.wait()
            return {"situacao": "tempo_excedido", "resultados": []}
        finally:
            _encerrar_grupo(proc)   # netos que tenham sobrado

        try:
            if os.path.getsize(destino) > ARQUIVO_BYTES:
                raise ValueError
            with open(destino, encoding="utf-8") as f:
                saida = json.load(f)
            if not saida.get("carregou"):
                return {"situacao": "erro", "resultados": [], "erro": str(saida.get("erro", ""))[:80]}
            brutos = saida["resultados"]
            if not isinstance(brutos, list) or len(brutos) != len(entradas):
                raise ValueError
        except (OSError, ValueError, KeyError, TypeError, AttributeError, RecursionError):
            # sem arquivo: morto por limite de memória, CPU ou sinal; ou resultado adulterado
            return {"situacao": "erro", "resultados": []}

    resultados = []
    for r in brutos:
        try:
            if isinstance(r, dict) and "valor" in r:
                resultados.append({"valor": codificar(r["valor"])})
            else:
                resultados.append({"erro": str(r.get("erro", "Exception"))[:80]})
        except (PedidoInvalido, ValueError, RecursionError, AttributeError):
            resultados.append({"erro": "ValorNaoComparavel"})
    return {"situacao": "ok", "resultados": resultados}


def ler_pedido(corpo):
    """Valida o corpo e devolve (codigo, funcao, entradas em Python)."""
    try:
        dados = json.loads(corpo)
    except (ValueError, RecursionError):
        raise PedidoInvalido("JSON inválido")
    if not isinstance(dados, dict):
        raise PedidoInvalido("corpo inválido")
    codigo, funcao, entradas = dados.get("codigo"), dados.get("funcao"), dados.get("entradas")
    if not isinstance(codigo, str) or len(codigo) > MAX_CODIGO:
        raise PedidoInvalido("codigo inválido")
    if not isinstance(funcao, str) or not funcao.isidentifier():
        raise PedidoInvalido("funcao inválida")
    if not isinstance(entradas, list) or not 0 < len(entradas) <= MAX_CASOS:
        raise PedidoInvalido("entradas inválidas")
    try:
        argumentos = [decodificar(e) for e in entradas]
    except (ValueError, RecursionError):
        raise PedidoInvalido("entradas inválidas")
    if not all(isinstance(a, list) for a in argumentos):
        raise PedidoInvalido("cada entrada é uma lista de argumentos")
    return codigo, funcao, argumentos


def autorizado(cabecalho, segredo):
    if not segredo:   # sem segredo configurado, ninguém entra
        return False
    return hmac.compare_digest((cabecalho or "").encode(), f"Bearer {segredo}".encode())


class handler(BaseHTTPRequestHandler):
    def _responder(self, status, corpo):
        dados = json.dumps(corpo).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_POST(self):
        if not autorizado(self.headers.get("authorization"), os.environ.get("EXECUTOR_SEGREDO")):
            return self._responder(401, {"erro": "não autorizado"})
        try:
            tamanho = int(self.headers.get("content-length") or 0)
        except ValueError:
            tamanho = -1
        if not 0 < tamanho <= MAX_CORPO:
            return self._responder(413, {"erro": "corpo ausente ou grande demais"})
        try:
            codigo, funcao, entradas = ler_pedido(self.rfile.read(tamanho))
        except PedidoInvalido as e:
            return self._responder(400, {"erro": str(e)})
        self._responder(200, executar(codigo, funcao, entradas))

    def do_GET(self):
        self._responder(405, {"erro": "use POST"})

    def log_message(self, *_):   # não registra corpo nem cabeçalhos
        pass

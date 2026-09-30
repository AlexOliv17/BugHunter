"""Servidor local do executor, só para desenvolvimento (S4-01).

    python servidor_local.py          # escuta em http://127.0.0.1:3071/api/executar

O segredo vem de EXECUTOR_SEGREDO no ambiente ou, se ausente, de app/.env.local.
No Windows não há limites de memória e de arquivo (o módulo resource é só Unix);
o isolamento real é o da Vercel, verificado na S4-07.
"""

import os
import re
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ / "api"))

from executar import handler  # noqa: E402

PORTA = 3071


class Local(handler):
    def do_POST(self):
        if self.path.split("?")[0] != "/api/executar":
            return self._responder(404, {"erro": "rota inexistente"})
        super().do_POST()


if not os.environ.get("EXECUTOR_SEGREDO"):
    env_local = RAIZ.parent / "app" / ".env.local"
    if env_local.exists():
        achado = re.search(r"^EXECUTOR_SEGREDO=(.+)$", env_local.read_text(encoding="utf-8"), re.M)
        if achado:
            os.environ["EXECUTOR_SEGREDO"] = achado.group(1).strip()
if not os.environ.get("EXECUTOR_SEGREDO"):
    sys.exit("EXECUTOR_SEGREDO não definido (nem no ambiente, nem em app/.env.local)")

print(f"executor local em http://127.0.0.1:{PORTA}/api/executar")
ThreadingHTTPServer(("127.0.0.1", PORTA), Local).serve_forever()

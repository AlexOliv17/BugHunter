# Executor do Verificar (rota A', DA-08)

Função Python que roda o código do aluno sobre as entradas da suíte oculta e devolve
os valores obtidos. É publicada num **projeto Vercel separado**, com Root Directory
`executor`, cuja única variável de ambiente é `EXECUTOR_SEGREDO`. Nenhuma credencial do
Supabase ou do modelo de linguagem fica neste projeto.

- O esperado nunca chega aqui: a comparação (D-27) acontece no servidor Next.js (D-26).
- O filho roda com ambiente vazio, pasta temporária própria, `python -I -S`, limites de
  memória (256 MB), CPU, tamanho de arquivo (1 MB) e arquivos abertos, em sessão própria
  encerrada ao fim, e com a saída descartada. Tempo limite: 5 s (RN-03).
- Exceções devolvem só o tipo (`ZeroDivisionError`), nunca a mensagem, que poderia conter
  uma entrada oculta.
- Valores trafegam em "fio", JSON com o tipo explícito (`{"t": "float", "v": "8.0"}`),
  para o JavaScript não confundir 8 com 8.0 nem arredondar inteiros grandes.
  Casos de referência em `tests/dados/fio.json`, usados pelos dois lados.

```bash
python -m unittest discover -s tests -t .   # testes
python servidor_local.py                    # desenvolvimento: http://127.0.0.1:3071/api/executar
```

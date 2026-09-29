// Copia os arquivos do Pyodide do pacote npm para public/pyodide, para que o
// navegador os carregue do próprio domínio, sem depender de CDN. Roda antes
// do build e do dev; a pasta de destino não é versionada.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(raiz, "node_modules", "pyodide");
const destino = join(raiz, "public", "pyodide");
const arquivos = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

mkdirSync(destino, { recursive: true });
for (const arquivo of arquivos) cpSync(join(origem, arquivo), join(destino, arquivo));
console.log(`pyodide: ${arquivos.length} arquivos copiados para public/pyodide`);

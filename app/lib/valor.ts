// Valores Python no servidor Next.js (S4-01): leitura da suíte oculta, o "fio"
// trocado com o executor e a regra de comparação da D-27. Funções puras.
//
// O JavaScript não distingue 8 de 8.0 e arredonda inteiros acima de 2^53; a D-27
// depende dos dois (inteiros: igualdade exata; decimais: tolerância relativa).
// Por isso os valores carregam o tipo: a suíte é lida com o texto original de
// cada número, e o executor devolve os obtidos já com o tipo (executor/api/executar.py).

export type Valor =
  | { t: "int"; v: bigint }
  | { t: "float"; v: number; fonte?: string }   // fonte: o texto original, repassado como está
  | { t: "bool"; v: boolean }
  | { t: "str"; v: string }
  | { t: "none" }
  | { t: "list"; v: Valor[] }
  | { t: "dict"; v: Record<string, Valor> };

export type Fio =
  | { t: "int" | "float"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "str"; v: string }
  | { t: "none" }
  | { t: "list"; v: Fio[] }
  | { t: "dict"; v: Record<string, Fio> };

export class ValorInvalido extends Error {}

type Contexto = { source?: string };

// JSON (como o Python grava) -> Valor, guardando se cada número era inteiro ou decimal.
export function lerValor(texto: string): Valor {
  return JSON.parse(texto, function (this: unknown, _chave: string, v: unknown, ctx?: Contexto): Valor {
    if (typeof v === "number") {
      const fonte = ctx?.source;
      // sem o texto original não dá para saber o tipo: falha em vez de adivinhar
      if (fonte === undefined) throw new ValorInvalido("JSON.parse sem acesso ao texto original");
      return /[.eE]/.test(fonte) ? { t: "float", v, fonte } : { t: "int", v: BigInt(fonte) };
    }
    if (typeof v === "boolean") return { t: "bool", v };
    if (typeof v === "string") return { t: "str", v };
    if (v === null) return { t: "none" };
    if (Array.isArray(v)) return { t: "list", v: v as Valor[] };
    return { t: "dict", v: v as Record<string, Valor> };
  }) as Valor;
}

export type CasoOculto = { entrada: Valor & { t: "list" }; esperado: Valor };

// suite_oculta: lista de {entrada, esperado} (D-26), entrada = lista de argumentos.
export function lerSuite(texto: string): CasoOculto[] {
  const suite = lerValor(texto);
  if (suite.t !== "list" || suite.v.length === 0) throw new ValorInvalido("suíte vazia ou fora do formato");
  return suite.v.map((caso) => {
    if (caso.t !== "dict" || caso.v.entrada?.t !== "list" || !("esperado" in caso.v)) {
      throw new ValorInvalido("caso fora do formato {entrada, esperado}");
    }
    return { entrada: caso.v.entrada, esperado: caso.v.esperado };
  });
}

export function paraFio(valor: Valor): Fio {
  switch (valor.t) {
    case "int":
      return { t: "int", v: valor.v.toString() };
    case "float":
      return { t: "float", v: valor.fonte ?? reprDecimal(valor.v) };
    case "list":
      return { t: "list", v: valor.v.map(paraFio) };
    case "dict":
      return { t: "dict", v: Object.fromEntries(Object.entries(valor.v).map(([k, x]) => [k, paraFio(x)])) };
    default:
      return valor;
  }
}

// Texto que o float() do Python lê de volta no mesmo número.
function reprDecimal(n: number): string {
  if (Number.isNaN(n)) return "nan";
  if (n === Infinity) return "inf";
  if (n === -Infinity) return "-inf";
  const s = String(n);
  return /[.eE]/.test(s) ? s : s + ".0";
}

const DECIMAIS_ESPECIAIS: Record<string, number> = { nan: NaN, inf: Infinity, "-inf": -Infinity };

// Fio vindo do executor -> Valor. Qualquer coisa fora do formato é recusada.
export function deFio(fio: unknown, profundidade = 0): Valor {
  if (profundidade > 200) throw new ValorInvalido("fio profundo demais");
  if (typeof fio !== "object" || fio === null || Array.isArray(fio)) throw new ValorInvalido("fio malformado");
  const { t, v } = fio as { t?: unknown; v?: unknown };
  if (t === "int" && typeof v === "string" && /^-?\d+$/.test(v)) return { t: "int", v: BigInt(v) };
  if (t === "float" && typeof v === "string") {
    const n = v in DECIMAIS_ESPECIAIS ? DECIMAIS_ESPECIAIS[v] : Number(v);
    if (Number.isNaN(n) && v !== "nan") throw new ValorInvalido("decimal malformado");
    return { t: "float", v: n, fonte: v };
  }
  if (t === "bool" && typeof v === "boolean") return { t: "bool", v };
  if (t === "str" && typeof v === "string") return { t: "str", v };
  if (t === "none") return { t: "none" };
  if (t === "list" && Array.isArray(v)) return { t: "list", v: v.map((x) => deFio(x, profundidade + 1)) };
  if (t === "dict" && typeof v === "object" && v !== null && !Array.isArray(v)) {
    return { t: "dict", v: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deFio(x, profundidade + 1)])) };
  }
  throw new ValorInvalido("fio malformado");
}

// ───────────── D-27: espelho de pipeline/bughunter_pipeline/comparacao.py ─────────────

export const TOLERANCIA_RELATIVA = 1e-9;

const numero = (x: Valor): x is Valor & { t: "int" | "float" } => x.t === "int" || x.t === "float";

// math.isclose(a, b, rel_tol=1e-9, abs_tol=0)
function proximos(a: number, b: number): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const diferenca = Math.abs(a - b);
  return diferenca <= Math.abs(TOLERANCIA_RELATIVA * b) || diferenca <= Math.abs(TOLERANCIA_RELATIVA * a);
}

export function iguais(obtido: Valor, esperado: Valor): boolean {
  if (esperado.t === "bool" || obtido.t === "bool") {
    return obtido.t === "bool" && esperado.t === "bool" && obtido.v === esperado.v;
  }
  if (numero(esperado) && numero(obtido)) {
    if (esperado.t === "float" || obtido.t === "float") return proximos(Number(obtido.v), Number(esperado.v));
    return obtido.v === esperado.v;
  }
  if (esperado.t === "list" && obtido.t === "list") {
    return obtido.v.length === esperado.v.length && esperado.v.every((e, i) => iguais(obtido.v[i], e));
  }
  if (esperado.t === "dict" && obtido.t === "dict") {
    const chavesO = Object.keys(obtido.v), chavesE = Object.keys(esperado.v);
    return chavesO.length === chavesE.length && chavesE.every((k) => Object.hasOwn(obtido.v, k) && iguais(obtido.v[k], esperado.v[k]));
  }
  if (esperado.t === "str" && obtido.t === "str") return obtido.v === esperado.v;
  return esperado.t === "none" && obtido.t === "none";
}

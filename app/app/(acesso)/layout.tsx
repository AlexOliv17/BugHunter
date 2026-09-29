// Layout das telas de acesso (cadastro e login), conforme o protótipo de Login.
// O código de exemplo é fictício e fora do catálogo: um exercício real aqui
// entregaria a linha do defeito numa tela pública (RNF-03).

const EXEMPLO = [
  { texto: "def conta_vogais(palavra):" },
  { texto: "    total = 0" },
  { texto: "    for i in range(len(palavra) - 1):", destaque: true },
  { texto: "        if palavra[i] in 'aeiou':" },
  { texto: "            total = total + 1" },
  { texto: "    return total" },
];

export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen grid-cols-[1.1fr_1fr] bg-fundo text-texto">
      <section className="flex flex-col justify-between border-r border-borda px-16 py-12">
        <div className="flex items-center gap-3 text-xl font-semibold">
          <span aria-hidden className="text-destaque">◎</span> BugHunter
        </div>
        <div className="max-w-xl">
          <h2 className="text-5xl font-semibold leading-tight">Encontre o defeito.<br />Depois conserte.</h2>
          <p className="mt-6 text-lg text-texto-secundario">
            Todo exercício começa com um código que já funcionou. Um defeito foi plantado nele.
            Aponte a linha antes de editar.
          </p>
          <pre aria-hidden className="mt-8 rounded border border-borda bg-painel py-5 font-mono text-sm">
            {EXEMPLO.map((linha) => (
              <div key={linha.texto} className={`px-6 leading-7 ${linha.destaque ? "bg-destaque/15 text-destaque" : "text-texto-secundario"}`}>
                {linha.texto}
              </div>
            ))}
          </pre>
        </div>
        <p className="text-sm text-texto-apagado">Fundamentos de Programação · 4 categorias de defeito</p>
      </section>
      <section className="flex items-center justify-center px-16">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}

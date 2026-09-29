import Link from "next/link";
import { redirect } from "next/navigation";

import { iniciais, nomeDe } from "@/lib/nome";
import { usuarioAtual } from "@/lib/sessao";
import { sair } from "./acoes";

// Cabeçalho das telas logadas. Elo e ranking do protótipo ficam de fora da v1
// (Requisitos §6); o cabeçalho tem só a marca, o aluno e o Sair (D-28).
export default async function LayoutLogado({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  const nome = nomeDe(usuario);

  return (
    <div className="flex min-h-screen flex-col bg-fundo text-texto">
      <header className="flex h-16 items-center justify-between border-b border-borda px-10">
        <Link href="/temas" className="flex items-center gap-3 text-lg font-semibold">
          <span aria-hidden className="text-destaque">◎</span> BugHunter
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-texto-secundario">{nome}</span>
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded bg-painel text-sm font-semibold text-texto-secundario">
            {iniciais(nome)}
          </span>
          <form action={sair}>
            <button type="submit" className="h-9 rounded border border-borda px-3 text-sm text-texto-secundario transition-colors hover:border-texto-apagado hover:text-texto">
              Sair
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}

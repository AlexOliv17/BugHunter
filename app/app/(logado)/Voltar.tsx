import Link from "next/link";

// Botão Voltar das telas logadas (D-30): leva à tela anterior na hierarquia, não ao
// histórico do navegador. Temas é a home e não tem; a marca no cabeçalho leva a ela.
export function Voltar({ href, para }: { href: string; para: string }) {
  return (
    <Link href={href} aria-label={`Voltar para ${para}`}
      className="inline-flex h-9 items-center gap-2 rounded border border-borda px-3 text-sm text-texto-secundario transition-colors hover:border-texto-apagado hover:text-texto">
      <span aria-hidden>←</span> Voltar
    </Link>
  );
}

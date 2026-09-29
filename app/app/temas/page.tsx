import type { Metadata } from "next";

import { exigirUsuario } from "@/lib/sessao";

export const metadata: Metadata = { title: "Temas · BugHunter" };

// Provisório: a tela de temas com os cards e o progresso é a S2-04. Por ora, só
// confirma a sessão, para o fluxo de login (RF-02) poder ser testado.
export default async function PaginaTemas() {
  const usuario = await exigirUsuario("/temas");
  const nome = (usuario.user_metadata?.nome as string | undefined) ?? usuario.email;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">Temas</h1>
      <p className="text-texto-secundario">Olá, {nome}.</p>
    </main>
  );
}

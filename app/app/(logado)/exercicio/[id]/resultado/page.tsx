import type { Metadata } from "next";

import { exigirUsuario } from "@/lib/sessao";
import { TelaResultado } from "./TelaResultado";

export const metadata: Metadata = { title: "Resultado · BugHunter" };

// Tela 7, feedback final (RF-15). O conteúdo vem de /api/feedback e /api/gabarito,
// que só respondem para tentativa encerrada do próprio aluno.
export default async function PaginaResultado({ params }: PageProps<"/exercicio/[id]/resultado">) {
  const { id } = await params;
  await exigirUsuario(`/exercicio/${id}/resultado`);
  return <TelaResultado tentativaId={id} />;
}

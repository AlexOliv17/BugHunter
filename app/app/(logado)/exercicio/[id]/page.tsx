import type { Metadata } from "next";

import { exigirUsuario } from "@/lib/sessao";
import { TelaExercicio } from "./TelaExercicio";

export const metadata: Metadata = { title: "Exercício · BugHunter" };

export default async function PaginaExercicio({ params }: PageProps<"/exercicio/[id]">) {
  const { id } = await params;
  await exigirUsuario(`/exercicio/${id}`);
  // O conteúdo do exercício não vai no HTML: a tela o pede a POST /api/tentativa (D-20).
  return <TelaExercicio tentativaId={id} />;
}

import type { Metadata } from "next";

import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = { title: "Entrar · BugHunter" };

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { proximo } = await searchParams;
  return <FormularioLogin proximo={typeof proximo === "string" ? proximo : undefined} />;
}

import type { Metadata } from "next";

import { FormularioCadastro } from "./FormularioCadastro";

export const metadata: Metadata = { title: "Criar conta · BugHunter" };

export default function PaginaCadastro() {
  return <FormularioCadastro />;
}

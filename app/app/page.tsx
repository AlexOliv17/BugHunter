import Link from "next/link";

import { criarClienteServidor } from "@/lib/supabase/servidor";

export default async function Inicio() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  const nome = data.user?.user_metadata?.nome as string | undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">BugHunter</h1>
      {data.user
        ? <p className="text-texto-secundario">Olá, {nome ?? data.user.email}.</p>
        : <Link href="/cadastro" className="text-destaque hover:underline">Criar conta</Link>}
    </main>
  );
}

import { redirect } from "next/navigation";

import { DESTINO_APOS_ENTRAR } from "@/lib/rotas";
import { criarClienteServidor } from "@/lib/supabase/servidor";

// A raiz não tem tela própria: quem está logado vai aos temas, quem não está, ao login.
// O proxy já faz esse desvio; aqui fica a garantia caso ele não rode.
export default async function Inicio() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? DESTINO_APOS_ENTRAR : "/login");
}

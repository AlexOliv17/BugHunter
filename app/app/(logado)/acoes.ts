"use server";

import { redirect } from "next/navigation";

import { criarClienteServidor } from "@/lib/supabase/servidor";

// Sair (D-28): encerra a sessão e volta ao login.
export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}

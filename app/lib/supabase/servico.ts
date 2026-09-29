import "server-only";

import { createClient } from "@supabase/supabase-js";

// Cliente com a chave de serviço: ignora RLS. Só existe no servidor ("server-only"),
// só é usado pelos endpoints que gravam ou leem o que o aluno não pode ler direto
// (DA-07), e nunca vai ao navegador nem ao executor de código do aluno (RF-11).
export function criarClienteServico() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

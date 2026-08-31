import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a service_role key: ignora RLS e pode chamar a Admin API
 * (ex.: auth.admin.inviteUserByEmail). Só pode ser usado em código
 * server-side (Server Actions, Route Handlers) — nunca em componentes
 * "use client", ou a chave vaza para o navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione a chave em .env.local."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

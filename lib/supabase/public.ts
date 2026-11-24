import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/server";

export function createPublicClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el entorno.",
    );
  }

  return createClient<Database>(env.url, env.key, {
    auth: { persistSession: false },
  });
}

import { cookies } from "next/headers";
import type { SessionUser } from "@/components/user-provider";
import { createClient, getSupabaseEnv } from "@/lib/supabase/server";

export async function getSessionUser(): Promise<SessionUser | null> {
  // Marca siempre la lectura como dinámica (request-time), incluso si faltan env vars en build.
  await cookies();
  if (!getSupabaseEnv()) return null;

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claimsData?.claims?.sub) {
      return null;
    }

    const userId = claimsData.claims.sub;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      if (profileError) {
        console.error("[auth] Error leyendo perfil en profiles:", profileError);
      }
      return null;
    }

    return { id: profile.id, username: profile.username };
  } catch (err) {
    console.error("[auth] Error leyendo la sesión:", err);
    return null;
  }
}

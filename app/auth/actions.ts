"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient, getSupabaseEnv } from "@/lib/supabase/server";

export type SignUpInput = { username: string; email: string; password: string };
export type SignInInput = { email: string; password: string };

export type AuthResult =
  | { status: "success" } // la acción redirige a /library
  | { status: "error"; message: string }; // texto en español, en mayúsculas

const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USERNAME_ERROR = "EL USUARIO DEBE TENER 3–10 CARACTERES: LETRAS, NÚMEROS O _.";
const EMAIL_ERROR = "CORREO ELECTRÓNICO NO VÁLIDO.";
const PASSWORD_ERROR = "LA CONTRASEÑA DEBE TENER AL MENOS 6 CARACTERES.";
const USERNAME_TAKEN_ERROR = "ESE USUARIO YA ESTÁ EN USO.";
const EMAIL_TAKEN_ERROR = "YA EXISTE UNA CUENTA CON ESE CORREO.";
const INVALID_CREDENTIALS_ERROR = "CORREO O CONTRASEÑA INCORRECTOS.";
const RATE_LIMIT_ERROR = "DEMASIADOS INTENTOS. ESPERA UN MOMENTO.";
const GENERIC_AUTH_ERROR = "NO SE PUDO CONECTAR CON EL VAULT. INTÉNTALO DE NUEVO.";

function fail(message: string): AuthResult {
  return { status: "error", message };
}

function mapSupabaseAuthError(error: AuthError, mode: "signUp" | "signIn"): string {
  const code = error.code ?? "";
  const msg = error.message.toLowerCase();

  if (
    error.status === 429 ||
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    msg.includes("rate limit")
  ) {
    return RATE_LIMIT_ERROR;
  }

  if (mode === "signUp") {
    if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("already exists")) {
      return EMAIL_TAKEN_ERROR;
    }
    if (msg.includes("database error saving new user")) {
      return USERNAME_TAKEN_ERROR;
    }
  }

  if (mode === "signIn") {
    if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
      return INVALID_CREDENTIALS_ERROR;
    }
  }

  console.error(`[auth] Error de Supabase en ${mode}:`, error);
  return GENERIC_AUTH_ERROR;
}

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const username = typeof input?.username === "string" ? input.username.trim().toUpperCase() : "";
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";

  if (!USERNAME_RE.test(username)) {
    return fail(USERNAME_ERROR);
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return fail(EMAIL_ERROR);
  }
  if (password.length < 6 || password.length > 72) {
    return fail(PASSWORD_ERROR);
  }

  if (!getSupabaseEnv()) {
    console.error("[auth] Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el entorno.");
    return fail(GENERIC_AUTH_ERROR);
  }

  try {
    const supabase = await createClient();

    const { data: existing, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (lookupError) {
      console.error("[auth] Error comprobando username en profiles:", lookupError);
      return fail(GENERIC_AUTH_ERROR);
    }
    if (existing) {
      return fail(USERNAME_TAKEN_ERROR);
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (error) {
      return fail(mapSupabaseAuthError(error, "signUp"));
    }

    if (!data.session) {
      console.error(
        "[auth] signUp completado sin sesión activa (verifica que 'Confirm email' esté desactivado en Supabase).",
      );
      return fail(GENERIC_AUTH_ERROR);
    }
  } catch (err) {
    console.error("[auth] Fallo inesperado en signUp:", err);
    return fail(GENERIC_AUTH_ERROR);
  }

  redirect("/library");
}

export async function signIn(input: SignInInput): Promise<AuthResult> {
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return fail(EMAIL_ERROR);
  }
  if (password.length < 6 || password.length > 72) {
    return fail(PASSWORD_ERROR);
  }

  if (!getSupabaseEnv()) {
    console.error("[auth] Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el entorno.");
    return fail(GENERIC_AUTH_ERROR);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return fail(mapSupabaseAuthError(error, "signIn"));
    }
  } catch (err) {
    console.error("[auth] Fallo inesperado en signIn:", err);
    return fail(GENERIC_AUTH_ERROR);
  }

  redirect("/library");
}

export async function signOut(): Promise<void> {
  try {
    if (getSupabaseEnv()) {
      const supabase = await createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[auth] Error en signOut:", error);
      }
    }
  } catch (err) {
    console.error("[auth] Fallo inesperado en signOut:", err);
  }

  redirect("/library");
}

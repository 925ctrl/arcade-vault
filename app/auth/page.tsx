import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser } from "@/lib/supabase/session";

export const metadata: Metadata = {
  title: "Acceso · Arcade Vault",
};

export default async function AuthPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/library");
  }
  return <AuthForm />;
}

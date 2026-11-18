"use server";

import { Resend } from "resend";
import { GENERIC_CONTACT_ERROR } from "@/lib/contact";

export type ContactInput = {
  name: string; // obligatorio, 1–60 caracteres tras trim
  email: string; // obligatorio, formato email, máx. 254 caracteres
  message: string; // obligatorio, 10–2000 caracteres tras trim
  website: string; // honeypot: debe llegar vacío
};

export type ContactResult =
  | { status: "success"; name: string }
  | { status: "error"; message: string }; // texto en español para la terminal

const FROM = "Arcade Vault <onboarding@resend.dev>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message: string): ContactResult {
  return { status: "error", message };
}

export async function sendContactMessage(input: ContactInput): Promise<ContactResult> {
  // Un server action es un endpoint público: el input no es de fiar aunque venga de nuestro formulario.
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const message = typeof input?.message === "string" ? input.message.trim() : "";
  const website = typeof input?.website === "string" ? input.website : "";

  // Honeypot: el bot no debe saber que fue descartado.
  if (website) return { status: "success", name };

  if (name.length < 1 || name.length > 60) {
    return fail("EL NOMBRE DEBE TENER ENTRE 1 Y 60 CARACTERES.");
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return fail("EL CORREO ELECTRÓNICO NO ES VÁLIDO.");
  }
  if (message.length < 10 || message.length > 2000) {
    return fail("EL MENSAJE DEBE TENER ENTRE 10 Y 2000 CARACTERES.");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error("[contact] Falta RESEND_API_KEY o CONTACT_TO_EMAIL en el entorno.");
    return fail(GENERIC_CONTACT_ERROR);
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`,
    });
    if (error) {
      console.error("[contact] Resend devolvió un error:", error);
      return fail(GENERIC_CONTACT_ERROR);
    }
  } catch (err) {
    console.error("[contact] Fallo al llamar a Resend:", err);
    return fail(GENERIC_CONTACT_ERROR);
  }

  return { status: "success", name };
}

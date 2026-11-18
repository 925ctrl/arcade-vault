"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { sendContactMessage, type ContactResult } from "@/app/about/actions";
import { useReveal } from "@/lib/use-reveal";

type HighlightKind = "HEART" | "BROWSER" | "PLANT";

const HIGHLIGHTS: { kind: HighlightKind; text: string; color: string }[] = [
  { kind: "HEART", text: "HECHO CON ❤️ PARA JUGADORES", color: "magenta" },
  { kind: "BROWSER", text: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR", color: "cyan" },
  { kind: "PLANT", text: "PROYECTO EN CONSTANTE CRECIMIENTO", color: "green" },
];

function HighlightIcon({ kind }: { kind: HighlightKind }) {
  const C = "currentColor";
  if (kind === "HEART")
    return (
      <svg className="hl-icon" viewBox="0 0 16 16" aria-hidden="true">
        <g fill={C}>
          <rect x="2" y="3" width="4" height="2" /><rect x="10" y="3" width="4" height="2" />
          <rect x="1" y="4" width="2" height="4" /><rect x="13" y="4" width="2" height="4" />
          <rect x="2" y="8" width="2" height="2" /><rect x="12" y="8" width="2" height="2" />
          <rect x="3" y="9" width="10" height="2" />
          <rect x="4" y="11" width="8" height="2" />
          <rect x="5" y="12" width="6" height="2" />
          <rect x="6" y="13" width="4" height="1" />
          <rect x="7" y="14" width="2" height="1" />
        </g>
      </svg>
    );
  if (kind === "BROWSER")
    return (
      <svg className="hl-icon" viewBox="0 0 16 16" aria-hidden="true">
        <g fill={C}>
          <rect x="1" y="2" width="14" height="12" fill="none" stroke={C} strokeWidth="1.4" />
          <rect x="1" y="2" width="14" height="3" />
          <rect x="3" y="3" width="1" height="1" fill="#0a0a0f" />
          <rect x="5" y="3" width="1" height="1" fill="#0a0a0f" />
          <rect x="7" y="3" width="1" height="1" fill="#0a0a0f" />
          <rect x="3" y="7" width="4" height="1" /><rect x="3" y="9" width="6" height="1" /><rect x="3" y="11" width="3" height="1" />
        </g>
      </svg>
    );
  return (
    <svg className="hl-icon" viewBox="0 0 16 16" aria-hidden="true">
      <g fill={C}>
        <rect x="7" y="2" width="2" height="10" />
        <rect x="4" y="4" width="3" height="2" /><rect x="9" y="6" width="3" height="2" />
        <rect x="3" y="3" width="2" height="2" /><rect x="11" y="5" width="2" height="2" />
        <rect x="3" y="12" width="10" height="2" />
        <rect x="4" y="14" width="8" height="1" />
      </g>
    </svg>
  );
}

type ContactForm = { name: string; email: string; message: string };

const EMPTY_FORM: ContactForm = { name: "", email: "", message: "" };

export function About() {
  useReveal();

  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [shake, setShake] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [, setResult] = useState<ContactResult | null>(null); // se muestra en los pasos 10 y 11

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [shake]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setShake(true);
      return;
    }
    startTransition(async () => {
      setResult(await sendContactMessage({ ...form, website: "" }));
    });
  };

  return (
    <div className="about fade-in">
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y
          celebrar los arcades que definieron una generación, haciéndolos accesibles para todos, en
          cualquier lugar y sin costo.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={h.kind}
              className={`highlight ${h.color}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <HighlightIcon kind={h.kind} />
              <div className="hl-text pixel">{h.text}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar" />
        <div className="div-pixels">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <div className="div-bar" />
      </div>

      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
              Escríbenos.
            </p>
            <div className="contact-tips">
              <div className="tip"><span className="tip-led" />RESPUESTA EN 24-48H</div>
              <div className="tip"><span className="tip-led y" />SUGERENCIAS BIENVENIDAS</div>
              <div className="tip"><span className="tip-led m" />SIN SPAM, JAMÁS</div>
            </div>
          </div>

          <form className={`contact-form${shake ? " shake" : ""}`} onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="contact-name">NOMBRE</label>
              <input
                id="contact-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="px_kai"
                maxLength={60}
              />
            </div>
            <div className="field">
              <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
              <input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jugador@vault.gg"
                maxLength={254}
              />
            </div>
            <div className="field">
              <label htmlFor="contact-message">MENSAJE</label>
              <textarea
                id="contact-message"
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Cuéntanos qué tienes en mente…"
                maxLength={2000}
              />
            </div>
            <button
              className="btn xl press"
              type="submit"
              style={{ width: "100%" }}
              disabled={isPending}
            >
              {isPending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

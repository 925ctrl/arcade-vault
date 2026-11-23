"use client";

import { useState, useTransition, type FormEvent } from "react";
import { signIn, signOut, signUp } from "@/app/auth/actions";

const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm() {
  const [tab, setTab] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const switchTab = (next: "in" | "up") => {
    setTab(next);
    setError(null);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    const cleanEmail = email.trim();

    if (tab === "up") {
      const cleanUsername = username.trim().toUpperCase();
      if (!USERNAME_RE.test(cleanUsername)) {
        setError("EL USUARIO DEBE TENER 3–10 CARACTERES: LETRAS, NÚMEROS O _.");
        return;
      }
    }

    if (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) {
      setError("CORREO ELECTRÓNICO NO VÁLIDO.");
      return;
    }

    if (password.length < 6 || password.length > 72) {
      setError("LA CONTRASEÑA DEBE TENER AL MENOS 6 CARACTERES.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const res =
        tab === "up"
          ? await signUp({ username, email: cleanEmail, password })
          : await signIn({ email: cleanEmail, password });

      if (res?.status === "error") {
        setError(res.message);
      }
    });
  };

  const handleGuest = () => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      await signOut();
    });
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "in" ? "on" : ""}
            disabled={isPending}
            onClick={() => switchTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === "up" ? "on" : ""}
            disabled={isPending}
            onClick={() => switchTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor="auth-username">Usuario</label>
              <input
                id="auth-username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="px_kai"
                autoComplete="username"
                maxLength={10}
                disabled={isPending}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
              maxLength={254}
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Contraseña</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === "in" ? "current-password" : "new-password"}
              maxLength={72}
              disabled={isPending}
            />
          </div>

          <button className="btn lg mt-2! w-full!" type="submit" disabled={isPending}>
            {isPending ? "CONECTANDO…" : tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
          </button>

          {error && (
            <div className="auth-error" role="alert">
              [ERR] {error}
            </div>
          )}
        </form>

        <button
          className="btn ghost mt-2.5! w-full!"
          type="button"
          disabled={isPending}
          onClick={handleGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost social-soon" type="button" disabled>
            <span>◆ GOOGLE</span>
            <span className="soon-tag">PRÓXIMAMENTE</span>
          </button>
          <button className="btn ghost social-soon" type="button" disabled>
            <span>▣ GITHUB</span>
            <span className="soon-tag">PRÓXIMAMENTE</span>
          </button>
        </div>

        <div className="mt-[18px] text-center text-[11px] tracking-[0.1em] text-ink-faint">
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}

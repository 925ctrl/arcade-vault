"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import { useUser } from "@/components/user-provider";

export function Nav() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // trailingSlash: true hace que pathname llegue como "/library/"; se normaliza para comparar.
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const { user } = useUser();

  const homeActive = pathname === "/";
  const libraryActive = pathname === "/library" || pathname.startsWith("/games/");
  const hallActive = pathname === "/hall-of-fame";
  const aboutActive = pathname === "/about";
  const authActive = pathname === "/auth";
  const close = () => setOpen(false);

  const handleSignOut = () => {
    close();
    startTransition(async () => {
      await signOut();
    });
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={homeActive ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/library" className={libraryActive ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/hall-of-fame" className={hallActive ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={aboutActive ? "active" : ""}>
            Acerca de Nosotros
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button
            className="btn ghost auth-btn"
            type="button"
            disabled={isPending}
            onClick={handleSignOut}
          >
            {user.username} ▾
          </button>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan mb-4! text-[11px]!">
          MENÚ
        </div>
        <Link href="/" className={homeActive ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link href="/library" className={libraryActive ? "active" : ""} onClick={close}>
          Biblioteca
        </Link>
        <Link href="/hall-of-fame" className={hallActive ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/about" className={aboutActive ? "active" : ""} onClick={close}>
          Acerca de Nosotros
        </Link>
        {user ? (
          <button
            type="button"
            className="mobile-signout"
            disabled={isPending}
            onClick={handleSignOut}
          >
            {user.username} · Salir
          </button>
        ) : (
          <Link href="/auth" className={authActive ? "active" : ""} onClick={close}>
            Iniciar Sesión
          </Link>
        )}
        <div className="flex-1"></div>
        <div className="pixel text-[9px]! tracking-[0.16em]! text-ink-faint!">
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}

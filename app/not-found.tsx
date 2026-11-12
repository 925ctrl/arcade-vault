import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 · Arcade Vault",
};

export default function NotFound() {
  return (
    <section className="av-hero fade-in" style={{ padding: "96px 24px" }}>
      <h1 className="neon-magenta flicker" style={{ fontSize: "clamp(48px, 14vw, 120px)" }}>
        404
      </h1>
      <div className="pixel neon-cyan" style={{ fontSize: 14, marginTop: 24 }}>
        GAME OVER
      </div>
      <div className="sub" style={{ marginTop: 16 }}>
        ESTA PÁGINA NO EXISTE EN EL VAULT <span className="blink">_</span>
      </div>
      <Link href="/" className="btn" style={{ marginTop: 32 }}>
        VOLVER AL VAULT
      </Link>
    </section>
  );
}

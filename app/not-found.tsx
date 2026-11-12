import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 · Arcade Vault",
};

export default function NotFound() {
  return (
    <section className="av-hero fade-in px-6! py-24!">
      <h1 className="neon-magenta flicker text-[clamp(48px,14vw,120px)]!">
        404
      </h1>
      <div className="pixel neon-cyan mt-6! text-[14px]!">
        GAME OVER
      </div>
      <div className="sub mt-4!">
        ESTA PÁGINA NO EXISTE EN EL VAULT <span className="blink">_</span>
      </div>
      <Link href="/" className="btn mt-8!">
        VOLVER AL VAULT
      </Link>
    </section>
  );
}

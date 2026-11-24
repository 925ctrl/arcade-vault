"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GameError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[games] Error cargando el juego:", error);
  }, [error]);

  return (
    <section className="av-hero fade-in px-6! py-24!">
      <div className="pixel neon-magenta text-[clamp(14px,2.4vw,20px)]! tracking-[0.14em]!">
        [ERR] NO SE PUDO CARGAR EL JUEGO.
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          className="btn yellow lg"
          onClick={() => (retry ?? reset)()}
        >
          REINTENTAR
        </button>
        <Link href="/library" className="btn ghost lg">
          VOLVER AL VAULT
        </Link>
      </div>
    </section>
  );
}

import Link from "next/link";
import type { Game } from "@/lib/games";

export function ComingSoon({ game }: { game: Game }) {
  return (
    <div className="av-player fade-in">
      <div className="crt">
        <div className="crt-screen">
          <div className="crt-content z-5! px-6">
            <div className="flex flex-col items-center gap-5">
              <div className="pixel neon-yellow text-[22px]! tracking-[0.14em]!">
                PRÓXIMAMENTE
              </div>
              <div className="pixel neon-cyan text-[13px]! tracking-[0.1em]!">
                {game.title}
              </div>
              <div className="mono text-[11px] tracking-[0.16em] text-ink-dim">
                CARTUCHO EN PREPARACIÓN · VUELVE PRONTO
              </div>
              <Link href="/library" className="btn lg mt-2">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>EN ESPERA</span>
        </div>
      </div>
    </div>
  );
}

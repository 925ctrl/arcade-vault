"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  AsteroidsCanvas,
  type AsteroidsCanvasHandle,
} from "@/components/asteroids-canvas";
import { useUser } from "@/components/user-provider";
import type { AsteroidsPhase, AsteroidsStats } from "@/games/asteroids/engine";
import type { Game } from "@/lib/games";
import { appendScore } from "@/lib/storage";

const INITIAL_STATS: AsteroidsStats = { score: 0, lives: 3, level: 1 };

export function GamePlayer({ game }: { game: Game }) {
  const { user } = useUser();
  const gameRef = useRef<AsteroidsCanvasHandle | null>(null);
  const [stats, setStats] = useState<AsteroidsStats>(INITIAL_STATS);
  const [phase, setPhase] = useState<AsteroidsPhase>("ready");
  const [saved, setSaved] = useState(false);

  const { score, lives, level } = stats;
  const paused = phase === "paused";
  const over = phase === "over";
  const canTogglePause =
    phase === "playing" || phase === "dead" || phase === "paused";
  const name = user?.username ?? "INVITADO";

  // Solo los jugadores con sesión guardan puntuación, siempre con su username.
  const saveScore = () => {
    if (!user) return;
    appendScore({ game: game.id, score, name: user.username, at: Date.now() });
    setSaved(true);
  };

  const restart = () => {
    setSaved(false);
    gameRef.current?.reset();
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="hud-stats">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v text-ink!">{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button
            className="btn yellow"
            disabled={!canTogglePause}
            onClick={() =>
              paused ? gameRef.current?.resume() : gameRef.current?.pause()
            }
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            className="btn magenta"
            disabled={over}
            onClick={() => gameRef.current?.end()}
          >
            FIN
          </button>
          <Link href={`/games/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <AsteroidsCanvas
            ref={gameRef}
            onStats={setStats}
            onPhase={setPhase}
          />
          {paused && (
            <div className="crt-content z-5! bg-black/60!">
              <div>
                <div className="pixel neon-yellow text-[22px]!">EN PAUSA</div>
                <div className="mono mt-2.5 text-[11px] tracking-[0.16em] text-ink-dim">
                  PULSA REANUDAR O P PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!user && (
              <p className="save-locked">
                Inicia sesión para guardar tus puntuaciones en el Salón de la
                Fama.
              </p>
            )}
            {saved && <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>}
            <div className="actions">
              {!user ? (
                <Link href="/auth" className="btn yellow">
                  INICIAR SESIÓN
                </Link>
              ) : (
                !saved && (
                  <button className="btn yellow" onClick={saveScore}>
                    GUARDAR PUNTUACIÓN
                  </button>
                )
              )}
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/library" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

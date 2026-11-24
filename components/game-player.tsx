"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { startGame, submitScore } from "@/app/games/[id]/play/actions";
import { useUser } from "@/components/user-provider";
import { ENGINES } from "@/games/registry";
import type { EngineHandle, EnginePhase, EngineStats } from "@/games/types";
import { readCachedBest, writeCachedBest } from "@/lib/best-cache";
import type { Game } from "@/lib/games";

type SaveState =
  | { status: "idle" }
  | { status: "saving"; isRetry: boolean }
  | { status: "record"; maxScore: number }
  | { status: "not_record"; maxScore: number }
  | { status: "error"; message: string };

export function GamePlayer({ game }: { game: Game }) {
  const { Canvas: Engine, initialStats } = ENGINES[game.id];
  const { user } = useUser();
  const gameRef = useRef<EngineHandle | null>(null);
  const [stats, setStats] = useState<EngineStats>(initialStats);
  const [phase, setPhase] = useState<EnginePhase>("ready");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  const prevPhaseRef = useRef<EnginePhase>("ready");
  const startedRef = useRef(false);
  const submittedRef = useRef(false);
  const scoreRef = useRef(0);
  const lastScoreRef = useRef(0);

  const { score, lives, lines, level } = stats;
  const paused = phase === "paused";
  const over = phase === "over";
  const canTogglePause =
    phase === "playing" || phase === "dead" || phase === "paused";
  const name = user?.username ?? "INVITADO";

  const runSubmit = useCallback(
    (finalScore: number, isRetry: boolean) => {
      if (!user) return;
      setSaveState({ status: "saving", isRetry });
      startTransition(async () => {
        try {
          const result = await submitScore(game.id, finalScore);
          if (result.status === "success") {
            writeCachedBest(user.id, game.id, result.maxScore);
            setSaveState(
              result.isRecord
                ? { status: "record", maxScore: result.maxScore }
                : { status: "not_record", maxScore: result.maxScore },
            );
          } else {
            setSaveState({ status: "error", message: result.message });
          }
        } catch {
          setSaveState({
            status: "error",
            message: "NO SE PUDO GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO.",
          });
        }
      });
    },
    [game.id, user],
  );

  const handleStats = useCallback((nextStats: EngineStats) => {
    scoreRef.current = nextStats.score;
    setStats(nextStats);
  }, []);

  const handlePhase = useCallback(
    (nextPhase: EnginePhase) => {
      const prev = prevPhaseRef.current;
      prevPhaseRef.current = nextPhase;
      setPhase(nextPhase);

      if (prev === "ready" && nextPhase === "playing") {
        startedRef.current = true;
        submittedRef.current = false;
        if (user) {
          void startGame(game.id);
        }
      }

      if (
        nextPhase === "over" &&
        user &&
        startedRef.current &&
        !submittedRef.current
      ) {
        submittedRef.current = true;
        const finalScore = scoreRef.current;
        lastScoreRef.current = finalScore;

        const cachedBest = readCachedBest(user.id, game.id);
        if (cachedBest !== null && finalScore <= cachedBest) {
          setSaveState({ status: "not_record", maxScore: cachedBest });
        } else {
          runSubmit(finalScore, false);
        }
      }
    },
    [game.id, runSubmit, user],
  );

  const retrySave = () => {
    runSubmit(lastScoreRef.current, true);
  };

  const resetSession = useCallback(() => {
    startedRef.current = false;
    submittedRef.current = false;
    prevPhaseRef.current = "ready";
    scoreRef.current = 0;
    lastScoreRef.current = 0;
    setPhase("ready");
    setStats(initialStats);
    setSaveState({ status: "idle" });
  }, [initialStats]);

  // Con `cacheComponents`, Next conserva el estado de la ruta al salir de ella
  // (React <Activity>), pero sus efectos se desmontan: el canvas destruye su
  // motor y al volver crea uno nuevo en fase "ready". La sesión del jugador
  // pertenece a ese motor, así que se reinicia junto con él.
  useEffect(() => resetSession, [resetSession]);

  const restart = () => {
    resetSession();
    gameRef.current?.reset();
  };

  const showRetryButton =
    saveState.status === "error" ||
    (saveState.status === "saving" && saveState.isRetry);

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
          {lives !== undefined && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          {lines !== undefined && (
            <div className="hud-stat lines">
              <div className="l">Líneas</div>
              <div className="v">{lines.toLocaleString("es-ES")}</div>
            </div>
          )}
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
          {Engine && (
            <Engine
              ref={gameRef}
              onStats={handleStats}
              onPhase={handlePhase}
            />
          )}
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
            {user && saveState.status === "saving" && (
              <div className="save-status">GUARDANDO…</div>
            )}
            {user && saveState.status === "record" && (
              <div className="toast-saved">
                ▸ ¡NUEVO RÉCORD! PUNTUACIÓN GUARDADA_
              </div>
            )}
            {user && saveState.status === "not_record" && (
              <div className="save-no-record">
                <div>▸ LÁSTIMA, NO SUPERASTE TU RÉCORD</div>
                <div className="best-val">
                  RÉCORD ACTUAL: {saveState.maxScore.toLocaleString("es-ES")}
                </div>
              </div>
            )}
            {user && saveState.status === "error" && (
              <div className="save-error">[ERR] {saveState.message}</div>
            )}
            <div className="actions">
              {!user && (
                <Link href="/auth" className="btn yellow">
                  INICIAR SESIÓN
                </Link>
              )}
              {user && showRetryButton && (
                <button
                  className="btn yellow"
                  disabled={isPending || saveState.status === "saving"}
                  onClick={retrySave}
                >
                  REINTENTAR GUARDADO
                </button>
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

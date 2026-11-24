"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import {
  createAsteroidsGame,
  type AsteroidsGame,
  type AsteroidsPhase,
  type AsteroidsStats,
} from "@/games/asteroids/engine";

export type AsteroidsCanvasHandle = {
  pause(): void;
  resume(): void;
  end(): void;
  reset(): void;
};

type AsteroidsCanvasProps = {
  ref?: Ref<AsteroidsCanvasHandle>;
  onStats: (stats: AsteroidsStats) => void;
  onPhase: (phase: AsteroidsPhase) => void;
};

export function AsteroidsCanvas({ ref, onStats, onPhase }: AsteroidsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);
  const callbacksRef = useRef({ onStats, onPhase });

  useEffect(() => {
    callbacksRef.current = { onStats, onPhase };
  }, [onStats, onPhase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = createAsteroidsGame(canvas, {
      onStats: (stats) => callbacksRef.current.onStats(stats),
      onPhase: (phase) => callbacksRef.current.onPhase(phase),
    });
    gameRef.current = game;

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      pause: () => gameRef.current?.pause(),
      resume: () => gameRef.current?.resume(),
      end: () => gameRef.current?.end(),
      reset: () => gameRef.current?.reset(),
    }),
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      aria-label="ROCAS"
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}

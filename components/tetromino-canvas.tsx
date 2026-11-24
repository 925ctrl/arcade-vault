"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import {
  createTetrominoGame,
  type TetrominoGame,
} from "@/games/tetromino/engine";
import type { EngineCanvasProps, EngineHandle } from "@/games/types";

export type TetrominoCanvasHandle = EngineHandle;

export function TetrominoCanvas({
  ref,
  onStats,
  onPhase,
}: EngineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<TetrominoGame | null>(null);
  const callbacksRef = useRef({ onStats, onPhase });

  useEffect(() => {
    callbacksRef.current = { onStats, onPhase };
  }, [onStats, onPhase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = createTetrominoGame(canvas, {
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
      aria-label="TETROMINO"
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}

import type { ComponentType } from "react";
import { AsteroidsCanvas } from "@/components/asteroids-canvas";
import { BreakoutCanvas } from "@/components/breakout-canvas";
import { TetrominoCanvas } from "@/components/tetromino-canvas";
import { ASTEROIDS_INITIAL_STATS } from "@/games/asteroids/constants";
import { BREAKOUT_INITIAL_STATS } from "@/games/breakout/constants";
import { TETROMINO_INITIAL_STATS } from "@/games/tetromino/constants";
import type { EngineCanvasProps, EngineStats } from "@/games/types";

export type EngineDefinition = {
  Canvas: ComponentType<EngineCanvasProps>;
  initialStats: EngineStats;
};

export const ENGINES: Record<string, EngineDefinition> = {
  asteroides: {
    Canvas: AsteroidsCanvas,
    initialStats: ASTEROIDS_INITIAL_STATS,
  },
  tetromino: {
    Canvas: TetrominoCanvas,
    initialStats: TETROMINO_INITIAL_STATS,
  },
  rompemuros: {
    Canvas: BreakoutCanvas,
    initialStats: BREAKOUT_INITIAL_STATS,
  },
};

export function hasEngine(id: string): boolean {
  return Object.hasOwn(ENGINES, id);
}

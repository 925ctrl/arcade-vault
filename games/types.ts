import type { Ref } from "react";

export type EngineStats = { score: number; lives: number; level: number };

export type EnginePhase = "ready" | "playing" | "dead" | "paused" | "over";

export type EngineHandle = {
  pause(): void;
  resume(): void;
  end(): void;
  reset(): void;
};

export type EngineCanvasProps = {
  ref?: Ref<EngineHandle>;
  onStats: (stats: EngineStats) => void;
  onPhase: (phase: EnginePhase) => void;
};

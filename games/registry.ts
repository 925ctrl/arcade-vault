import type { ComponentType } from "react";
import { AsteroidsCanvas } from "@/components/asteroids-canvas";
import type { EngineCanvasProps } from "@/games/types";

export const ENGINES: Record<string, ComponentType<EngineCanvasProps>> = {
  asteroides: AsteroidsCanvas,
};

export function hasEngine(id: string): boolean {
  return Object.hasOwn(ENGINES, id);
}

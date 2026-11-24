"use server";

import { updateTag } from "next/cache";
import { getGame } from "@/lib/games";
import { SCORES_TAG } from "@/lib/scores";
import { createClient } from "@/lib/supabase/server";
import { readSessionUser } from "@/lib/supabase/session";

export type SubmitScoreResult =
  | { status: "success"; maxScore: number; isRecord: boolean }
  | { status: "error"; message: string };

const MAX_SCORE = 9_999_999;

export async function startGame(gameId: string): Promise<void> {
  const user = await readSessionUser();
  if (!user) return;

  const game = getGame(gameId);
  if (!game?.playable) return;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("start_game", { p_game_id: gameId });
    if (error) {
      console.error("[scores] Error en start_game:", error);
    }
  } catch (err) {
    console.error("[scores] Error en start_game:", err);
  }
}

export async function submitScore(
  gameId: string,
  score: number,
): Promise<SubmitScoreResult> {
  const user = await readSessionUser();
  if (!user) {
    return { status: "error", message: "INICIA SESIÓN PARA GUARDAR." };
  }

  const game = getGame(gameId);
  if (
    !game?.playable ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE
  ) {
    return { status: "error", message: "PUNTUACIÓN NO VÁLIDA." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_score", {
      p_game_id: gameId,
      p_score: score,
    });

    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      console.error("[scores] Error en submit_score:", error);
      return {
        status: "error",
        message: "NO SE PUDO GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO.",
      };
    }

    if (row.is_record) {
      updateTag(SCORES_TAG);
    }

    return {
      status: "success",
      maxScore: row.max_score,
      isRecord: row.is_record,
    };
  } catch (err) {
    console.error("[scores] Error en submit_score:", err);
    return {
      status: "error",
      message: "NO SE PUDO GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO.",
    };
  }
}

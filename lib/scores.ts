import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export type LeaderboardEntry = {
  rank: number;
  username: string;
  score: number;
  date: string;
};

export type GameStats = { plays: number; best: number | null };

export type MyBest = { username: string; score: number; date: string };

export const SCORES_TAG = "scores";

function formatUtcDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export async function getTopScores(
  limit: number,
): Promise<Record<string, LeaderboardEntry[]>> {
  "use cache";
  cacheTag(SCORES_TAG);
  cacheLife("minutes");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("leaderboard")
    .select("game_id, rank, username, max_score, max_score_at")
    .lte("rank", limit)
    .order("game_id", { ascending: true })
    .order("rank", { ascending: true });

  if (error) {
    throw new Error(`Error leyendo leaderboard: ${error.message}`);
  }

  const byGame: Record<string, LeaderboardEntry[]> = {};
  for (const row of data ?? []) {
    if (
      row.game_id === null ||
      row.rank === null ||
      row.username === null ||
      row.max_score === null ||
      row.max_score_at === null
    ) {
      continue;
    }
    const list = (byGame[row.game_id] ??= []);
    list.push({
      rank: Number(row.rank),
      username: row.username,
      score: row.max_score,
      date: formatUtcDate(row.max_score_at),
    });
  }

  return byGame;
}

export async function getGameStats(): Promise<Record<string, GameStats>> {
  "use cache";
  cacheTag(SCORES_TAG);
  cacheLife("minutes");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("game_stats")
    .select("game_id, plays, best");

  if (error) {
    throw new Error(`Error leyendo game_stats: ${error.message}`);
  }

  const stats: Record<string, GameStats> = {};
  for (const row of data ?? []) {
    if (row.game_id === null || row.plays === null) continue;
    stats[row.game_id] = {
      plays: Number(row.plays),
      best: row.best,
    };
  }

  return stats;
}

export async function getMyBests(
  userId: string,
): Promise<Record<string, MyBest>> {
  // El cliente con cookies lee la sesión con `Date.now()`: solo se permite en el
  // App Shell dentro de una caché privada (por sesión, en el navegador).
  "use cache: private";
  cacheTag(SCORES_TAG);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("player_stats")
      .select("game_id, max_score, max_score_at, profiles!inner(username)")
      .eq("user_id", userId)
      .gt("max_score", 0);

    if (error) {
      console.error("[scores] Error leyendo player_stats del usuario:", error);
      return {};
    }

    const bests: Record<string, MyBest> = {};
    for (const row of data ?? []) {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0]
        : row.profiles;
      if (!profile?.username || !row.max_score_at) continue;
      bests[row.game_id] = {
        username: profile.username,
        score: row.max_score,
        date: formatUtcDate(row.max_score_at),
      };
    }

    return bests;
  } catch (err) {
    console.error("[scores] Error leyendo player_stats del usuario:", err);
    return {};
  }
}

export function formatPlays(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

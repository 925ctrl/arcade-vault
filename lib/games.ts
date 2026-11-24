import { cacheLife, cacheTag } from "next/cache";
import { hasEngine } from "@/games/registry";
import {
  categoriesOf,
  coverUrl,
  type Game,
  type GameCategory,
  type GameColor,
} from "@/lib/game-helpers";
import { createPublicClient } from "@/lib/supabase/public";

export { categoriesOf, coverUrl, type Game, type GameCategory, type GameColor };

export const GAMES_TAG = "games";

const VALID_CATEGORIES = new Set<GameCategory>([
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
]);

const VALID_COLORS = new Set<GameColor>(["cyan", "magenta", "yellow", "green"]);

function isGameCategory(value: string): value is GameCategory {
  return VALID_CATEGORIES.has(value as GameCategory);
}

function isGameColor(value: string): value is GameColor {
  return VALID_COLORS.has(value as GameColor);
}

export async function getGames(): Promise<Game[]> {
  "use cache";
  cacheTag(GAMES_TAG);
  cacheLife("minutes");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("games")
    .select(
      "id, title, short_description, long_description, category, color, cover_image, playable",
    )
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Error leyendo games: ${error.message}`);
  }

  const games: Game[] = [];
  for (const row of data ?? []) {
    if (!isGameCategory(row.category) || !isGameColor(row.color)) {
      console.error("[games] Fila descartada por category o color desconocido:", {
        id: row.id,
        category: row.category,
        color: row.color,
      });
      continue;
    }

    games.push({
      id: row.id,
      title: row.title,
      short: row.short_description,
      long: row.long_description,
      category: row.category,
      color: row.color,
      coverImage: row.cover_image,
      playable: row.playable && hasEngine(row.id),
    });
  }

  return games;
}

export async function getGame(id: string): Promise<Game | undefined> {
  const games = await getGames();
  return games.find((g) => g.id === id);
}

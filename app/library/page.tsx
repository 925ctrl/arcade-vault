import type { Metadata } from "next";
import { Suspense } from "react";
import { Library } from "@/components/library";
import { getGames, type Game } from "@/lib/games";
import { getGameStats, type GameStats } from "@/lib/scores";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
};

async function LibraryWithData() {
  let games: Game[] = [];
  let catalogError = false;
  try {
    games = await getGames();
  } catch (err) {
    console.error("[games] Error cargando catálogo en library:", err);
    catalogError = true;
  }

  let stats: Record<string, GameStats> = {};
  if (!catalogError) {
    try {
      stats = await getGameStats();
    } catch (err) {
      console.error("[scores] Error cargando game_stats en library:", err);
    }
  }

  return (
    <Library games={games} stats={stats} catalogError={catalogError} />
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<Library games={[]} stats={{}} />}>
      <LibraryWithData />
    </Suspense>
  );
}

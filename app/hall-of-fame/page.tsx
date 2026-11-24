import type { Metadata } from "next";
import { Suspense } from "react";
import { HallOfFame } from "@/components/hall-of-fame";
import { getGames, type Game } from "@/lib/games";
import { getMyBests, getTopScores, type LeaderboardEntry } from "@/lib/scores";
import { getSessionUser } from "@/lib/supabase/session";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
};

async function HallOfFameWithMyBests({
  games,
  top,
  error,
}: {
  games: Game[];
  top: Record<string, LeaderboardEntry[]>;
  error: boolean;
}) {
  const user = await getSessionUser();
  const myBests = user ? await getMyBests(user.id) : {};
  return (
    <HallOfFame games={games} top={top} myBests={myBests} error={error} />
  );
}

async function HallOfFameLoader() {
  let games: Game[] = [];
  let catalogError = false;

  try {
    games = await getGames();
  } catch (err) {
    console.error("[games] Error cargando catálogo en hall-of-fame:", err);
    catalogError = true;
  }

  if (catalogError) {
    return (
      <HallOfFame games={[]} top={{}} myBests={{}} catalogError />
    );
  }

  let top: Record<string, LeaderboardEntry[]> = {};
  let error = false;

  try {
    top = await getTopScores(12);
  } catch (err) {
    console.error("[scores] Error cargando top scores en hall-of-fame:", err);
    error = true;
  }

  return (
    <Suspense
      fallback={
        <HallOfFame games={games} top={top} myBests={{}} error={error} />
      }
    >
      <HallOfFameWithMyBests games={games} top={top} error={error} />
    </Suspense>
  );
}

export default function HallOfFamePage() {
  return (
    <Suspense fallback={<HallOfFame games={[]} top={{}} myBests={{}} />}>
      <HallOfFameLoader />
    </Suspense>
  );
}

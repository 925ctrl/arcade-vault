import type { Metadata } from "next";
import { Suspense } from "react";
import { Home } from "@/components/home";
import { getGames, type Game } from "@/lib/games";

export const metadata: Metadata = {
  title: "Inicio · Arcade Vault",
};

async function HomeWithGames() {
  let games: Game[] = [];
  let catalogError = false;
  try {
    games = await getGames();
  } catch (err) {
    console.error("[games] Error cargando catálogo en home:", err);
    catalogError = true;
  }
  return <Home games={games} catalogError={catalogError} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<Home games={[]} />}>
      <HomeWithGames />
    </Suspense>
  );
}

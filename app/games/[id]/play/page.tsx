import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/coming-soon";
import { GamePlayer } from "@/components/game-player";
import { getGame, getGames } from "@/lib/games";

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((g) => ({ id: g.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[id]/play">): Promise<Metadata> {
  const { id } = await params;
  try {
    const game = await getGame(id);
    return {
      title: game ? `${game.title} · Jugando · Arcade Vault` : "Arcade Vault",
    };
  } catch {
    return { title: "Arcade Vault" };
  }
}

// `params` es dato de URL: se lee dentro de <Suspense> para que el App Shell
// de la ruta no bloquee la navegación.
export default function PlayPage({ params }: PageProps<"/games/[id]/play">) {
  return (
    <Suspense fallback={null}>
      <Play params={params} />
    </Suspense>
  );
}

async function Play({ params }: Pick<PageProps<"/games/[id]/play">, "params">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return game.playable ? (
    <GamePlayer game={game} />
  ) : (
    <ComingSoon game={game} />
  );
}

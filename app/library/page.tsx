import type { Metadata } from "next";
import { Suspense } from "react";
import { Library } from "@/components/library";
import { getGameStats, type GameStats } from "@/lib/scores";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
};

async function LibraryWithStats() {
  let stats: Record<string, GameStats> = {};
  try {
    stats = await getGameStats();
  } catch (err) {
    console.error("[scores] Error cargando game_stats en library:", err);
  }
  return <Library stats={stats} />;
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<Library stats={{}} />}>
      <LibraryWithStats />
    </Suspense>
  );
}

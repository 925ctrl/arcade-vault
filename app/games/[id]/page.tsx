import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Leaderboard } from "@/components/leaderboard";
import { GAMES, getGame } from "@/lib/games";
import {
  formatPlays,
  getGameStats,
  getMyBests,
  getTopScores,
  type LeaderboardEntry,
} from "@/lib/scores";
import { getSessionUser } from "@/lib/supabase/session";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = getGame(id);
  return { title: game ? `${game.title} · Arcade Vault` : "Arcade Vault" };
}

async function GameStatCells({ gameId }: { gameId: string }) {
  let playsText = "—";
  let bestText = "—";

  try {
    const allStats = await getGameStats();
    const stats = allStats[gameId] ?? { plays: 0, best: null };
    playsText = formatPlays(stats.plays);
    bestText = stats.best !== null ? stats.best.toLocaleString("es-ES") : "—";
  } catch (err) {
    console.error("[scores] Error cargando game_stats en detalle:", err);
  }

  return (
    <>
      <div>
        <div className="l">Partidas</div>
        <div className="v">{playsText}</div>
      </div>
      <div>
        <div className="l">Mejor global</div>
        <div className="v text-magenta! [text-shadow:0_0_6px_rgba(255,0,110,0.5)]!">
          {bestText}
        </div>
      </div>
    </>
  );
}

function GameStatFallback() {
  return (
    <>
      <div>
        <div className="l">Partidas</div>
        <div className="v">—</div>
      </div>
      <div>
        <div className="l">Mejor global</div>
        <div className="v text-magenta! [text-shadow:0_0_6px_rgba(255,0,110,0.5)]!">
          —
        </div>
      </div>
    </>
  );
}

async function MyGameBest({
  gameId,
  gameTitle,
}: {
  gameId: string;
  gameTitle: string;
}) {
  const user = await getSessionUser();
  if (!user) return null;

  const bests = await getMyBests(user.id);
  const best = bests[gameId];
  if (!best) return null;

  return (
    <>
      <div className="lb-you-label">▸ TU MEJOR MARCA EN {gameTitle}</div>
      <div className="lb-row you">
        <div className="rk" />
        <div className="pl text-yellow!">
          {best.username}
          <div className="text-[10px] tracking-[0.1em] text-ink-faint">
            {best.date}
          </div>
        </div>
        <div className="sc text-yellow! [text-shadow:0_0_6px_rgba(245,255,0,0.5)]!">
          {best.score.toLocaleString("es-ES")}
        </div>
      </div>
    </>
  );
}

async function GameLeaderboard({
  gameId,
  gameTitle,
}: {
  gameId: string;
  gameTitle: string;
}) {
  let entries: LeaderboardEntry[] = [];
  let error = false;

  try {
    const top = await getTopScores(10);
    entries = top[gameId] ?? [];
  } catch (err) {
    console.error("[scores] Error cargando top scores en detalle:", err);
    error = true;
  }

  return (
    <Leaderboard
      entries={entries}
      error={error}
      footer={
        <Suspense fallback={null}>
          <MyGameBest gameId={gameId} gameTitle={gameTitle} />
        </Suspense>
      }
    />
  );
}

// `params` es dato de URL: se lee dentro de <Suspense> para que el App Shell
// de la ruta no bloquee la navegación.
export default function GameDetailPage({ params }: PageProps<"/games/[id]">) {
  return (
    <Suspense fallback={<div className="av-detail" aria-busy="true" />}>
      <GameDetail params={params} />
    </Suspense>
  );
}

async function GameDetail({
  params,
}: Pick<PageProps<"/games/[id]">, "params">) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div className="detail-info mt-5">
          <div className="detail-tags">
            <span>{game.category}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <Suspense fallback={<GameStatFallback />}>
              <GameStatCells gameId={game.id} />
            </Suspense>
            <div>
              <div className="l">Dificultad</div>
              <div className="v text-yellow! [text-shadow:0_0_6px_rgba(245,255,0,0.5)]!">
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            {game.playable ? (
              <Link href={`/games/${game.id}/play`} className="btn xl pulse">
                ▶ JUGAR AHORA
              </Link>
            ) : (
              <button className="btn xl" disabled>
                PRÓXIMAMENTE
              </button>
            )}
            <Link href="/library" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <Suspense fallback={<Leaderboard entries={[]} />}>
          <GameLeaderboard gameId={game.id} gameTitle={game.title} />
        </Suspense>
      </aside>
    </div>
  );
}

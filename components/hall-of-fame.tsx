"use client";

import Link from "next/link";
import { useState } from "react";
import type { Game } from "@/lib/games";
import type { LeaderboardEntry, MyBest } from "@/lib/scores";

const TOP_CLASS = ["top1", "top2", "top3"];

export function HallOfFame({
  games,
  top,
  myBests,
  error = false,
  catalogError = false,
}: {
  games: Game[];
  top: Record<string, LeaderboardEntry[]>;
  myBests: Record<string, MyBest>;
  error?: boolean;
  catalogError?: boolean;
}) {
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  const tab =
    selectedTab && games.some((g) => g.id === selectedTab)
      ? selectedTab
      : (games[0]?.id ?? "");

  const rows = tab ? (top[tab] ?? []) : [];
  const game = games.find((g) => g.id === tab);
  const best = tab ? (myBests[tab] ?? null) : null;

  const first = rows[0];
  const second = rows[1];
  const third = rows[2];

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel text-[10px]!">
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      {catalogError ? (
        <div className="catalog-error">
          [ERR] NO SE PUDO CARGAR EL CATÁLOGO.
        </div>
      ) : (
        <>
          <div className="hall-tabs">
            {games.map((g) => (
              <button
                key={g.id}
                className={"chip" + (tab === g.id ? " active" : "")}
                onClick={() => setSelectedTab(g.id)}
              >
                {g.title}
              </button>
            ))}
          </div>

          <div className="podium">
            <div className="podium-slot silver">
              <div className="rank-num">02</div>
              <div className="name">{second ? second.username : "---"}</div>
              <div className="score">
                {second ? second.score.toLocaleString("es-ES") : "---"}
              </div>
              <div className="date">{second ? second.date : "---"}</div>
            </div>
            <div className="podium-slot gold">
              <div className="pixel text-[9px]! tracking-[0.18em]! text-gold!">
                CAMPEÓN
              </div>
              <div className="rank-num mt-1! text-[36px]!">01</div>
              <div className="name">{first ? first.username : "---"}</div>
              <div className="score text-[20px]!">
                {first ? first.score.toLocaleString("es-ES") : "---"}
              </div>
              <div className="date">{first ? first.date : "---"}</div>
            </div>
            <div className="podium-slot bronze">
              <div className="rank-num">03</div>
              <div className="name">{third ? third.username : "---"}</div>
              <div className="score">
                {third ? third.score.toLocaleString("es-ES") : "---"}
              </div>
              <div className="date">{third ? third.date : "---"}</div>
            </div>
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {error ? (
              <div className="hall-error">
                [ERR] NO SE PUDO CARGAR EL RANKING.
              </div>
            ) : rows.length === 0 ? (
              <div className="hall-empty">SIN PUNTUACIONES TODAVÍA</div>
            ) : (
              rows.map((r, i) => (
                <div
                  key={`${tab}-${r.rank}-${r.username}`}
                  className={"tr" + (TOP_CLASS[i] ? " " + TOP_CLASS[i] : "")}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                  <div className="pl">{r.username}</div>
                  <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                  <div className="dt">{r.date}</div>
                </div>
              ))
            )}
            {best && game && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" />
                  <div className="pl text-yellow!">{best.username}</div>
                  <div className="sc text-yellow! [text-shadow:0_0_6px_rgba(245,255,0,0.5)]!">
                    {best.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">{best.date}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="mt-8 text-center">
        <Link href="/library" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

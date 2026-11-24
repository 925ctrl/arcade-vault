"use client";

import { useState } from "react";
import { GameCard } from "@/components/game-card";
import {
  categoriesOf,
  type Game,
  type GameCategory,
} from "@/lib/game-helpers";
import type { GameStats } from "@/lib/scores";

export function Library({
  games,
  stats,
  catalogError = false,
}: {
  games: Game[];
  stats: Record<string, GameStats>;
  catalogError?: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"TODOS" | GameCategory>("TODOS");

  const categories = categoriesOf(games);
  const activeCat = categories.includes(cat) ? cat : "TODOS";
  const query = q.toLowerCase();
  const filtered = games.filter(
    (g) =>
      (activeCat === "TODOS" || g.category === activeCat) &&
      g.title.toLowerCase().includes(query),
  );

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      {catalogError ? (
        <div className="px-8 pb-20">
          <div className="catalog-error">
            [ERR] NO SE PUDO CARGAR EL CATÁLOGO.
          </div>
        </div>
      ) : (
        <>
          <div className="av-filters">
            <div className="av-search">
              <span className="ico">⌕</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar un juego por nombre…"
              />
            </div>
            <div className="av-chips">
              {categories.map((c) => (
                <button
                  key={c}
                  className={"chip" + (activeCat === c ? " active" : "")}
                  onClick={() => setCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="av-grid">
            {filtered.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                best={stats[g.id]?.best ?? null}
              />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full p-20 text-center text-ink-faint">
                <div className="pixel mb-3 text-[14px] text-magenta">
                  NO HAY RESULTADOS
                </div>
                <div>Intenta otra búsqueda o categoría.</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

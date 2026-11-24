import type { ReactNode } from "react";
import type { LeaderboardEntry } from "@/lib/scores";

const TOP_CLASS = ["top1", "top2", "top3"];

export function Leaderboard({
  entries,
  error = false,
  footer,
}: {
  entries: LeaderboardEntry[];
  error?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {error ? (
        <div className="lb-error">[ERR] NO SE PUDO CARGAR EL RANKING.</div>
      ) : entries.length === 0 ? (
        <div className="lb-empty">SIN PUNTUACIONES TODAVÍA</div>
      ) : (
        entries.map((r, i) => (
          <div
            key={`${r.rank}-${r.username}`}
            className={"lb-row" + (TOP_CLASS[i] ? " " + TOP_CLASS[i] : "")}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">
              {r.username}
              <div className="text-[10px] tracking-[0.1em] text-ink-faint">
                {r.date}
              </div>
            </div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
          </div>
        ))
      )}
      {footer}
    </div>
  );
}

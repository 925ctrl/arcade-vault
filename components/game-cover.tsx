"use client";

import { useState } from "react";
import { coverUrl, type Game } from "@/lib/game-helpers";

export function GameCover({ game }: { game: Game }) {
  const url = coverUrl(game);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url && failedUrl !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="game-art"
        src={url}
        alt={`Portada de ${game.title}`}
        loading="lazy"
        onError={() => setFailedUrl(url)}
      />
    );
  }

  return (
    <div className={`game-art-fallback neon-${game.color}`}>
      <span>{game.title}</span>
    </div>
  );
}

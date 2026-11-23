// Persistencia mock de puntuaciones en localStorage (se reemplazará por Supabase en SPEC 05).
const SCORES_KEY = "av_scores";

export type SavedScore = { game: string; score: number; name: string; at: number };

function isSavedScore(v: unknown): v is SavedScore {
  if (typeof v !== "object" || v === null) return false;
  const s = v as SavedScore;
  return (
    typeof s.game === "string" &&
    typeof s.score === "number" &&
    typeof s.name === "string" &&
    typeof s.at === "number"
  );
}

export function parseScores(raw: string | null): SavedScore[] {
  if (raw === null) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(isSavedScore) : [];
  } catch {
    return [];
  }
}

// Snapshot crudo (string estable) para useSyncExternalStore.
export function getScoresSnapshot(): string | null {
  try {
    return window.localStorage.getItem(SCORES_KEY);
  } catch {
    return null;
  }
}

export function readScores(): SavedScore[] {
  return parseScores(getScoresSnapshot());
}

export function appendScore(score: SavedScore): void {
  try {
    window.localStorage.setItem(SCORES_KEY, JSON.stringify([...readScores(), score]));
  } catch {
    // almacenamiento no disponible: se ignora
  }
}

// Mayor puntuación guardada para un juego (de cualquier nombre), o null.
export function bestScoreFor(scores: SavedScore[], gameId: string): SavedScore | null {
  return scores
    .filter((s) => s.game === gameId)
    .reduce<SavedScore | null>((best, s) => (best && best.score >= s.score ? best : s), null);
}

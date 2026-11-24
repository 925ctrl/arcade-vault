const BEST_KEY = "av_best";

type BestCache = {
  userId: string;
  best: Record<string, number>;
};

function isBestCache(v: unknown): v is BestCache {
  if (typeof v !== "object" || v === null) return false;
  const c = v as BestCache;
  if (typeof c.userId !== "string" || typeof c.best !== "object" || c.best === null) {
    return false;
  }
  return true;
}

function readCache(): BestCache | null {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBestCache(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readCachedBest(userId: string, gameId: string): number | null {
  const cache = readCache();
  if (!cache || cache.userId !== userId) return null;
  const val = cache.best[gameId];
  return typeof val === "number" && Number.isFinite(val) ? val : null;
}

export function writeCachedBest(
  userId: string,
  gameId: string,
  maxScore: number,
): void {
  try {
    const current = readCache();
    const next: BestCache =
      current && current.userId === userId
        ? { userId, best: { ...current.best, [gameId]: maxScore } }
        : { userId, best: { [gameId]: maxScore } };
    window.localStorage.setItem(BEST_KEY, JSON.stringify(next));
  } catch {
    // almacenamiento no disponible: se ignora
  }
}

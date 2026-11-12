// Persistencia mock en localStorage (se reemplazará por backend en un spec futuro).
const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export type StoredUser = { name: string };
export type SavedScore = { game: string; score: number; name: string; at: number };

function readJSON(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function isStoredUser(v: unknown): v is StoredUser {
  return typeof v === "object" && v !== null && typeof (v as StoredUser).name === "string";
}

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

export function parseUser(raw: string | null): StoredUser | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return isStoredUser(v) ? v : null;
  } catch {
    return null;
  }
}

// Snapshot crudo (string estable) para useSyncExternalStore.
export function getUserSnapshot(): string | null {
  try {
    return window.localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

const userListeners = new Set<() => void>();

export function subscribeUser(listener: () => void): () => void {
  userListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === USER_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    userListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeUser(user: StoredUser | null): void {
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    // almacenamiento no disponible: se ignora
  }
  userListeners.forEach((l) => l());
}

export function readScores(): SavedScore[] {
  const v = readJSON(SCORES_KEY);
  return Array.isArray(v) ? v.filter(isSavedScore) : [];
}

export function appendScore(score: SavedScore): void {
  try {
    window.localStorage.setItem(SCORES_KEY, JSON.stringify([...readScores(), score]));
  } catch {
    // almacenamiento no disponible: se ignora
  }
}

// Mayor puntuación guardada para un juego (de cualquier nombre), o null.
export function bestScoreFor(gameId: string): SavedScore | null {
  return readScores()
    .filter((s) => s.game === gameId)
    .reduce<SavedScore | null>((best, s) => (best && best.score >= s.score ? best : s), null);
}

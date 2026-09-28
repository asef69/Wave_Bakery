/**
 * The rows each leaderboard view last showed, kept on this device so the
 * board appears at once on the next visit while a fresh copy loads.
 */
const KEY = "wavebakery_board_cache";

let memory: Record<string, unknown> | null = null;

function load(): Record<string, unknown> {
  if (memory) return memory;
  try {
    memory = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    memory = {};
  }
  return memory;
}

/** The rows last saved for this view, or null. */
export function cachedBoard<T>(key: string): T | null {
  return (load()[key] as T | undefined) ?? null;
}

export function saveBoard(key: string, rows: unknown): void {
  const all = load();
  all[key] = rows;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage full or blocked: the in-memory copy still serves this visit
  }
}

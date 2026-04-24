import { storage } from '../lib/telegram';
import { kyivIsoDate, prevIsoDate } from '../lib/kyivDate';

export type Stats = {
  /** Count of puzzles solved, all-time. */
  solved: number;
  /** Current streak of consecutive daily puzzles solved. */
  streak: number;
  /** Best streak ever. */
  bestStreak: number;
  /** Sum of stars across all solves — rough skill proxy. */
  totalStars: number;
  /** ISO date of the last solved daily (YYYY-MM-DD). */
  lastDaily: string | null;
};

const DEFAULT: Stats = {
  solved: 0,
  streak: 0,
  bestStreak: 0,
  totalStars: 0,
  lastDaily: null,
};

const KEY = 'stats';

export async function loadStats(): Promise<Stats> {
  const saved = await storage.getJSON<Partial<Stats>>(KEY);
  return { ...DEFAULT, ...(saved ?? {}) };
}

/** Synchronous read for first-paint UI (leaderboard me-row). `storage.set`
 *  mirrors writes into localStorage, so the local copy is authoritative on
 *  this device. */
export function loadStatsSync(): Stats {
  try {
    const raw = localStorage.getItem('digits:' + KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<Stats>) };
  } catch {
    return DEFAULT;
  }
}

export async function saveStats(s: Stats): Promise<void> {
  await storage.setJSON(KEY, s);
}

export function recordDailySolve(current: Stats, stars: number, now: Date = new Date()): Stats {
  const today = kyivIsoDate(now);
  if (current.lastDaily === today) {
    // Already recorded this daily — keep totals as-is.
    return current;
  }
  const continuing = current.lastDaily === prevIsoDate(today);
  const streak = continuing ? current.streak + 1 : 1;
  return {
    solved: current.solved + 1,
    streak,
    bestStreak: Math.max(current.bestStreak, streak),
    totalStars: current.totalStars + stars,
    lastDaily: today,
  };
}

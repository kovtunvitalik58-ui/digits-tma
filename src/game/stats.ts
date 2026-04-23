import { storage } from '../lib/telegram';

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

export async function saveStats(s: Stats): Promise<void> {
  await storage.setJSON(KEY, s);
}

function isoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayIso(ref = new Date()): string {
  const d = new Date(ref);
  d.setDate(d.getDate() - 1);
  return isoDate(d);
}

export function recordDailySolve(current: Stats, stars: number, now = new Date()): Stats {
  const today = isoDate(now);
  if (current.lastDaily === today) {
    // Already recorded this daily — only update star count if better run.
    return { ...current, totalStars: Math.max(current.totalStars, current.totalStars) };
  }
  const continuing = current.lastDaily === yesterdayIso(now);
  const streak = continuing ? current.streak + 1 : 1;
  return {
    solved: current.solved + 1,
    streak,
    bestStreak: Math.max(current.bestStreak, streak),
    totalStars: current.totalStars + stars,
    lastDaily: today,
  };
}

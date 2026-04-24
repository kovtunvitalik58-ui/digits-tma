import type { PuzzleState, Stars } from './types';
import { storage } from '../lib/telegram';

export type DailyResult = {
  /** YYYY-MM-DD in Europe/Kyiv — the key identifying the puzzle. */
  dateId: string;
  stars: Stars;
  target: number;
  closest: number | null;
  distance: number;
  opsUsed: number;
  finishedAt: number; // unix ms
  /** Full board state at the moment of finishing — lets a reopened app
   *  restore exactly what the player saw instead of a fresh puzzle.
   *  Optional because older results saved before this field was added
   *  won't have it. */
  finalState?: PuzzleState;
};

const KEY_PREFIX = 'daily:';

export async function saveDailyResult(r: DailyResult): Promise<void> {
  await storage.setJSON(`${KEY_PREFIX}${r.dateId}`, r);
}

export async function loadDailyResult(dateId: string): Promise<DailyResult | null> {
  return storage.getJSON<DailyResult>(`${KEY_PREFIX}${dateId}`);
}

/** Synchronous read used during the very first render so the restored board
 *  paints in the same frame as the rest of the UI. `saveDailyResult` mirrors
 *  every write into localStorage (via `storage.set`), so the local copy is
 *  authoritative on the device that produced the result. */
export function loadDailyResultSync(dateId: string): DailyResult | null {
  try {
    const raw = localStorage.getItem('digits:' + KEY_PREFIX + dateId);
    if (!raw) return null;
    return JSON.parse(raw) as DailyResult;
  } catch {
    return null;
  }
}

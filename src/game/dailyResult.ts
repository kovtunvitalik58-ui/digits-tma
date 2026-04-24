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

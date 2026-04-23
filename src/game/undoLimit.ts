import { storage } from '../lib/telegram';
import { kyivIsoDate } from '../lib/kyivDate';

export const UNDO_DAILY_LIMIT = 3;

type Blob = {
  /** ISO date (YYYY-MM-DD, Europe/Kyiv) of when `used` was last bumped. */
  date: string;
  used: number;
};

const KEY = 'undoLimit';

async function load(): Promise<Blob> {
  const today = kyivIsoDate();
  const saved = await storage.getJSON<Blob>(KEY);
  // Fresh counter at the start of a new Kyiv day.
  if (!saved || saved.date !== today) return { date: today, used: 0 };
  return saved;
}

export async function loadUndosRemaining(): Promise<number> {
  const blob = await load();
  return Math.max(0, UNDO_DAILY_LIMIT - blob.used);
}

/** Try to spend one undo. Returns whether it was allowed and how many remain. */
export async function consumeUndo(): Promise<{ ok: boolean; remaining: number }> {
  const blob = await load();
  if (blob.used >= UNDO_DAILY_LIMIT) return { ok: false, remaining: 0 };
  const next: Blob = { ...blob, used: blob.used + 1 };
  await storage.setJSON(KEY, next);
  return { ok: true, remaining: Math.max(0, UNDO_DAILY_LIMIT - next.used) };
}

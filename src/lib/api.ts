import { tg } from './telegram';
import type { DailyResult } from '../game/dailyResult';

function initData(): string | null {
  return tg()?.initData ?? null;
}

async function post<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const init = initData();
  if (!init) return null;
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, initData: init }),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Tell the backend about this player. Called on app mount. */
export function registerUser(referrer: number | null = null): void {
  const startParam = tg()?.initDataUnsafe?.start_param ?? null;
  void post('/api/register', {
    ...(referrer !== null ? { referrer } : {}),
    startParam,
  });
}

/** Push a finished puzzle to the backend so it can notify friends. */
export function pushResult(result: DailyResult): void {
  void post('/api/result', {
    result: {
      stars: result.stars,
      opsUsed: result.opsUsed,
      closest: result.closest,
      distance: result.distance,
      target: result.target,
      dateId: result.dateId,
    },
  });
}

export type LeaderRow = {
  id: string;
  name: string;
  photoUrl?: string;
  totalStars: number;
  today?: { stars: number; opsUsed: number; closest: number | null };
};

/** Fetch the authoritative leaderboard. Server returns the player + their
 *  friends, each with a real Telegram name + photo + today + total. */
export async function fetchLeaderboard(): Promise<{
  me: LeaderRow;
  friends: LeaderRow[];
} | null> {
  const r = await post<{ ok: boolean; me: LeaderRow; friends: LeaderRow[] }>(
    '/api/leaderboard',
    {},
  );
  if (!r?.ok) return null;
  return { me: r.me, friends: r.friends };
}

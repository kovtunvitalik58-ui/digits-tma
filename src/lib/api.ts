import { tg } from './telegram';
import type { DailyResult } from '../game/dailyResult';

function initData(): string | null {
  return tg()?.initData ?? null;
}

async function post(path: string, body: Record<string, unknown>): Promise<boolean> {
  const init = initData();
  if (!init) return false;
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, initData: init }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Tell the backend about this player. Called on app mount. */
export function registerUser(referrer: number | null = null): void {
  void post('/api/register', referrer !== null ? { referrer } : {});
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

import { tg } from './telegram';
import type { DailyResult } from '../game/dailyResult';
import { mergeFriendIds } from '../game/friends';

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

/** Tell the backend about this player. Called on app mount. The response
 *  includes the backend-known friend list, which we merge into local
 *  CloudStorage so inviters also see their invitees without needing to be
 *  invited back. */
export async function registerUser(referrer: number | null = null): Promise<void> {
  const startParam = tg()?.initDataUnsafe?.start_param ?? null;
  const r = await post<{ ok: boolean; friends?: string[] }>('/api/register', {
    ...(referrer !== null ? { referrer } : {}),
    startParam,
  });
  if (!r?.friends || r.friends.length === 0) return;
  const ids = r.friends.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  if (ids.length > 0) mergeFriendIds(ids).catch(() => void 0);
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

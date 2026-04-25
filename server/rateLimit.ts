/** Tiny in-memory sliding-window rate limiter. Keyed on whatever string
 *  the caller passes — typically `${endpoint}:${userId}`. Single-process
 *  Node, so an in-memory map is correct; if this ever moves behind multiple
 *  replicas, swap to Redis. */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Sweep expired buckets every 5 min so the map can't grow unbounded. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let sweeperStarted = false;
function startSweeper(): void {
  if (sweeperStarted) return;
  sweeperStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }, SWEEP_INTERVAL_MS).unref();
}

/** Returns true if the request is allowed; false if it's over the limit. */
export function take(key: string, limit: number, windowMs: number): boolean {
  startSweeper();
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

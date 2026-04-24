import fs from 'node:fs';
import path from 'node:path';

/** Shape of the on-disk JSON blob. Kept flat so hand-editing stays possible
 *  and a single `fs.writeFile` atomic-ish rewrite is enough to persist. */
export type DB = {
  users: Record<string, UserRecord>; // key = telegram user id, stringified
  /** Referral edges as an adjacency list. `friends[a]` = set of user ids who
   *  are linked to `a` (bidirectional, so each registration writes both sides). */
  friends: Record<string, string[]>;
  /** Daily results by date then by user. */
  results: Record<string, Record<string, ResultRecord>>;
};

export type UserRecord = {
  id: string;
  firstName?: string;
  username?: string;
  languageCode?: string;
  firstSeen: number;
  lastSeen: number;
};

export type ResultRecord = {
  stars: 0 | 1 | 2 | 3;
  opsUsed: number;
  closest: number | null;
  distance: number;
  target: number;
  finishedAt: number;
};

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'db.json');

let cache: DB | null = null;
let writeTimer: NodeJS.Timeout | null = null;

function empty(): DB {
  return { users: {}, friends: {}, results: {} };
}

/** Load once, cache in memory. Subsequent writes flush back to disk on a
 *  500 ms debounce so a burst of result + friend writes coalesce. */
export function load(): DB {
  if (cache) return cache;
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DB>;
    cache = { ...empty(), ...parsed };
  } catch {
    cache = empty();
  }
  return cache;
}

export function save(): void {
  if (!cache) return;
  const snapshot = JSON.stringify(cache);
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      // Atomic rewrite — write to tmp, then rename.
      const tmp = DB_PATH + '.tmp';
      fs.writeFileSync(tmp, snapshot);
      fs.renameSync(tmp, DB_PATH);
    } catch (err) {
      console.error('[db] failed to persist', err);
    }
  }, 500);
}

/** Idempotent — upserts user stamps and returns the record. */
export function touchUser(
  id: number,
  info: { firstName?: string; username?: string; languageCode?: string },
): UserRecord {
  const db = load();
  const key = String(id);
  const now = Date.now();
  const existing = db.users[key];
  const next: UserRecord = {
    id: key,
    firstName: info.firstName ?? existing?.firstName,
    username: info.username ?? existing?.username,
    languageCode: info.languageCode ?? existing?.languageCode,
    firstSeen: existing?.firstSeen ?? now,
    lastSeen: now,
  };
  db.users[key] = next;
  save();
  return next;
}

/** Adds a bidirectional friendship edge. Safe to call with matching ids —
 *  self-referrals are ignored. */
export function addFriendship(a: number, b: number): void {
  if (a === b) return;
  const db = load();
  const ka = String(a);
  const kb = String(b);
  const sa = new Set(db.friends[ka] ?? []);
  const sb = new Set(db.friends[kb] ?? []);
  sa.add(kb);
  sb.add(ka);
  db.friends[ka] = [...sa];
  db.friends[kb] = [...sb];
  save();
}

export function friendsOf(id: number): string[] {
  return load().friends[String(id)] ?? [];
}

export function putResult(dateId: string, userId: number, record: ResultRecord): void {
  const db = load();
  const day = (db.results[dateId] ??= {});
  day[String(userId)] = record;
  save();
}

export function resultsOn(dateId: string): Record<string, ResultRecord> {
  return load().results[dateId] ?? {};
}

export function allUserIds(): string[] {
  return Object.keys(load().users);
}

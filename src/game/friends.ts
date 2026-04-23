import { APP_NAME, BOT_USERNAME } from '../lib/config';
import { storage } from '../lib/telegram';

/** Prefix used in the `startapp` query param for referrals.
 *  Format: `ref_<telegramUserId>`. Keep it short — Telegram allows ≤ 64 chars. */
const REF_PREFIX = 'ref_';

/** Build the shareable deep-link that carries the inviter's Telegram ID. */
export function buildReferralUrl(inviterId: number | null): string {
  const base = `https://t.me/${BOT_USERNAME}/${APP_NAME}`;
  if (inviterId === null) return base;
  return `${base}?startapp=${REF_PREFIX}${inviterId}`;
}

/** Extract the referring user's ID from a start_param string.
 *  Returns null if the param is missing, malformed, or doesn't use `ref_`. */
export function parseRefFromStartParam(startParam: string | null): number | null {
  if (!startParam) return null;
  if (!startParam.startsWith(REF_PREFIX)) return null;
  const raw = startParam.slice(REF_PREFIX.length);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Friends known locally. The canonical source of truth lives on the backend —
 *  this cache keeps UX snappy and lets the app work before the server is up. */
type FriendsBlob = {
  /** IDs of users linked to me via referral (either direction). */
  ids: number[];
  /** Most recent referrer we saw at app open — useful for "how did I join" UI. */
  lastReferrer?: number;
};

const FRIENDS_KEY = 'friends';

async function loadFriends(): Promise<FriendsBlob> {
  const saved = await storage.getJSON<FriendsBlob>(FRIENDS_KEY);
  return saved ?? { ids: [] };
}

async function saveFriends(blob: FriendsBlob): Promise<void> {
  await storage.setJSON(FRIENDS_KEY, blob);
}

/** Record a friendship edge (my <-> their id). Idempotent — safe to call every
 *  time the app opens with a `ref_` param, even if the user has played before.
 *
 *  When a backend is wired up, this should also POST { me, their } to
 *  /friends/register so the OTHER side sees the edge without me needing to
 *  share back. For now we only have the local cache on the invitee's device. */
export async function registerFriendship(
  myId: number | null,
  theirId: number,
): Promise<FriendsBlob> {
  if (myId === theirId) {
    // Self-referral — ignore silently so a user can't game their own leaderboard.
    return loadFriends();
  }
  const blob = await loadFriends();
  blob.lastReferrer = theirId;
  if (!blob.ids.includes(theirId)) {
    blob.ids = [...blob.ids, theirId];
  }
  await saveFriends(blob);

  // TODO: POST to backend so the inviter sees me on THEIR leaderboard too.
  //   await fetch('/api/friends/register', { method: 'POST', body: JSON.stringify({ me: myId, their: theirId }) });
  //   Backend must:
  //     1) validate initData HMAC
  //     2) upsert both directions (me -> their, their -> me) — idempotent
  //     3) respond ok regardless of whether edge already existed
  void myId;

  return blob;
}

export async function getFriendIds(): Promise<number[]> {
  return (await loadFriends()).ids;
}

export async function getLastReferrer(): Promise<number | null> {
  return (await loadFriends()).lastReferrer ?? null;
}

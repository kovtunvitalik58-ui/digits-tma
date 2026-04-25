import express, { type Request, type Response } from 'express';
import cron from 'node-cron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { profileInfo, validateInitData, type TelegramUser } from './initData.js';
import {
  addFriendship,
  allUserIds,
  friendsOf,
  getUser,
  load as loadDB,
  putResult,
  resultsOn,
  totalStars,
  touchUser,
  type ResultRecord,
  type UserRecord,
} from './db.js';
import { sendMessage } from './telegram.js';
import { take as rateLimitTake } from './rateLimit.js';
import { todayPuzzle } from '../src/game/generator.js';
import { starsForDistance } from '../src/game/engine.js';
import { kyivIsoDate } from '../src/lib/kyivDate.js';

const BOT_TOKEN = process.env.BOT_TOKEN ?? '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const PORT = Number(process.env.PORT) || 3000;
const DIST = path.resolve(process.cwd(), 'dist');

if (BOT_TOKEN && !TELEGRAM_WEBHOOK_SECRET) {
  console.warn(
    '[server] TELEGRAM_WEBHOOK_SECRET is not set — webhook accepts unsigned ' +
      'updates. Set it and pass `secret_token` when calling setWebhook.',
  );
}
if (BOT_TOKEN && !ADMIN_TOKEN) {
  console.warn(
    '[server] ADMIN_TOKEN is not set — falling back to BOT_TOKEN for /api/debug. ' +
      'Set ADMIN_TOKEN to a separate value so admin URLs do not leak the bot token.',
  );
}

// --------------------------------------------------------------------------
// Routes
// --------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '128kb' }));

/** Pull + validate initData from the incoming body, returning the Telegram
 *  user on success or null (caller responds with 401). */
function authed(body: unknown): TelegramUser | null {
  if (!BOT_TOKEN) return null;
  const raw =
    body && typeof body === 'object' && 'initData' in body
      ? (body as { initData?: unknown }).initData
      : null;
  if (typeof raw !== 'string' || !raw) return null;
  return validateInitData(raw, BOT_TOKEN);
}

/** Per-user rate limit. Returns 429 + true when exhausted; false when ok to
 *  proceed. The first arg is a short label so different endpoints have
 *  separate budgets (e.g. /result uses a tighter cap than /leaderboard). */
function rateLimit(
  res: Response,
  label: string,
  userId: number,
  limit: number,
  windowMs: number,
): boolean {
  if (rateLimitTake(`${label}:${userId}`, limit, windowMs)) return false;
  res.status(429).json({ ok: false, error: 'rate-limited' });
  return true;
}

app.post('/api/register', (req: Request, res: Response) => {
  const user = authed(req.body);
  if (!user) {
    console.log('[register] 401 — bad initData');
    return res.status(401).json({ ok: false });
  }
  if (rateLimit(res, 'register', user.id, 30, 60_000)) return;
  // Friendship is added ONLY through the bot webhook /start ref_<id> path,
  // where the referrer comes from a real Telegram link. Accepting it from
  // the client here would let any player attach themselves to any other
  // user without consent, so it is intentionally ignored.
  touchUser(user.id, profileInfo(user));
  console.log(`[register] user=${user.id}`);
  return res.json({ ok: true });
});

/** Build the leaderboard payload — caller's profile + every friend's
 *  profile, plus today's daily result and all-time stars for each. */
type LeaderRow = {
  id: string;
  name: string;
  photoUrl?: string;
  totalStars: number;
  today?: { stars: number; opsUsed: number; closest: number | null };
};

function rowFor(id: number | string, dateId: string): LeaderRow {
  const u: UserRecord | null = getUser(id);
  const fallback = `Гравець ${String(id).slice(-4)}`;
  const fullName = u
    ? [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
    : '';
  const name = fullName || u?.username || fallback;
  const today = resultsOn(dateId)[String(id)];
  return {
    id: String(id),
    name,
    photoUrl: u?.photoUrl,
    totalStars: totalStars(id),
    today: today
      ? { stars: today.stars, opsUsed: today.opsUsed, closest: today.closest }
      : undefined,
  };
}

app.post('/api/leaderboard', (req: Request, res: Response) => {
  const user = authed(req.body);
  if (!user) return res.status(401).json({ ok: false });
  if (rateLimit(res, 'leaderboard', user.id, 60, 60_000)) return;
  // Touch on every leaderboard fetch so a returning player can't fall out
  // of the user table after a wipe.
  touchUser(user.id, profileInfo(user));
  const dateId = kyivIsoDate();
  const me = rowFor(user.id, dateId);
  const friends = friendsOf(user.id).map((fid) => rowFor(fid, dateId));
  return res.json({ ok: true, me, friends });
});

/** Re-derive the puzzle for the given Kyiv date using the same deterministic
 *  generator the client uses. Building a `Date` at noon UTC stays inside the
 *  same Kyiv calendar day regardless of DST, so `todayPuzzle(noon)` matches
 *  what every player saw for `dateId`. */
function puzzleForDate(dateId: string): { target: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateId)) return null;
  const noon = new Date(`${dateId}T12:00:00Z`);
  if (Number.isNaN(noon.getTime())) return null;
  if (kyivIsoDate(noon) !== dateId) return null;
  return todayPuzzle(noon);
}

/** Player can submit yesterday's result (rare clock-skew / late-finish case)
 *  but not arbitrary backfills. Anything older than 1 Kyiv day is rejected. */
function isAcceptableDateId(dateId: string): boolean {
  const today = kyivIsoDate();
  if (dateId === today) return true;
  const yesterday = kyivIsoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  return dateId === yesterday;
}

/** Hard cap on how many friends get pinged per finish. Past this point the
 *  notification is more spam than signal, and a player with a bloated friend
 *  graph could otherwise blow through Telegram rate limits in one POST. */
const MAX_NOTIFY_FRIENDS = 25;

app.post('/api/result', async (req: Request, res: Response) => {
  const user = authed(req.body);
  if (!user) return res.status(401).json({ ok: false });
  if (rateLimit(res, 'result', user.id, 5, 60_000)) return;
  touchUser(user.id, profileInfo(user));
  const body = req.body as {
    result?: {
      stars?: unknown;
      opsUsed?: unknown;
      closest?: unknown;
      distance?: unknown;
      target?: unknown;
      dateId?: unknown;
    };
  };
  const r = body.result;
  if (
    !r ||
    typeof r.opsUsed !== 'number' ||
    typeof r.distance !== 'number' ||
    typeof r.target !== 'number' ||
    typeof r.dateId !== 'string' ||
    (r.closest !== null && typeof r.closest !== 'number')
  ) {
    return res.status(400).json({ ok: false, error: 'bad-result' });
  }
  if (!Number.isFinite(r.opsUsed) || r.opsUsed < 0 || r.opsUsed > 50) {
    return res.status(400).json({ ok: false, error: 'bad-ops' });
  }
  if (!Number.isFinite(r.distance) || r.distance < 0) {
    return res.status(400).json({ ok: false, error: 'bad-distance' });
  }
  if (!isAcceptableDateId(r.dateId)) {
    return res.status(400).json({ ok: false, error: 'bad-date' });
  }
  const expected = puzzleForDate(r.dateId);
  if (!expected) {
    return res.status(400).json({ ok: false, error: 'bad-date' });
  }
  if (expected.target !== r.target) {
    return res.status(400).json({ ok: false, error: 'bad-target' });
  }

  // Re-derive stars from distance instead of trusting the client. Distance
  // alone is also bounded: zero means an exact hit, but otherwise it must
  // refer to a real card on the board, capped by a generous absolute bound
  // so a forged "3 stars at distance=0 with no closest" can't slip through.
  const distance = Math.floor(r.distance);
  const closest = typeof r.closest === 'number' ? Math.floor(r.closest) : null;
  if (distance === 0 && closest !== null && closest !== expected.target) {
    return res.status(400).json({ ok: false, error: 'closest-mismatch' });
  }
  if (distance > 0 && closest === null) {
    return res.status(400).json({ ok: false, error: 'closest-missing' });
  }
  const stars = starsForDistance(distance);

  // Refuse a regression — a previously-recorded better (or equal) result
  // stays. This blocks notification spam (each finish triggers pushes) and
  // keeps the leaderboard monotonic.
  const day = resultsOn(r.dateId);
  const existing = day[String(user.id)];
  if (existing && existing.stars >= stars) {
    return res.json({ ok: true, notified: 0, kept: 'existing' });
  }

  const alreadyFinished = Object.keys(day).filter((k) => k !== String(user.id));
  const record: ResultRecord = {
    stars,
    opsUsed: Math.floor(r.opsUsed),
    closest,
    distance,
    target: expected.target,
    finishedAt: Date.now(),
  };
  putResult(r.dateId, user.id, record);

  // Notify each friend whose first friend-of-the-day this is.
  const friends = friendsOf(user.id);
  const notifyCandidates = friends
    .filter((fid) => {
      if (fid === String(user.id)) return false;
      const friendsResultsToday = friendsOf(Number(fid)).filter((x) => x !== fid);
      const anyAlreadyFinished = friendsResultsToday.some(
        (x) => x !== String(user.id) && day[x] !== undefined && alreadyFinished.includes(x),
      );
      return !anyAlreadyFinished;
    })
    .slice(0, MAX_NOTIFY_FRIENDS);

  const name =
    user.first_name || user.username || 'Твій друг';
  const starStr = '⭐'.repeat(record.stars) + '☆'.repeat(3 - record.stars);
  const text = `🧮 ${name} щойно розв'язав сьогоднішній Digits — ${starStr}. Спробуй побити?`;
  await Promise.all(
    notifyCandidates.map((fid) =>
      sendMessage(fid, text, { openAppButton: 'Грати' }),
    ),
  );

  return res.json({ ok: true, notified: notifyCandidates.length });
});

/** Telegram webhook — receives /start with optional `ref_<id>` parameter.
 *  Direct-link mini-app `?startapp=` doesn't propagate `start_param` for
 *  this bot, so use the classic deep-link `/start ref_<id>` instead and
 *  link the friendship server-side. Reply with an inline keyboard that
 *  launches the mini-app via web_app button.
 *
 *  Authenticated by the `secret_token` set when calling setWebhook — without
 *  this check, anyone could POST forged updates to forge friendships and
 *  trigger sendMessage to arbitrary chat ids. */
app.post('/api/tg-webhook', async (req: Request, res: Response) => {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const got = req.header('x-telegram-bot-api-secret-token') ?? '';
    const want = TELEGRAM_WEBHOOK_SECRET;
    const ok =
      got.length === want.length &&
      crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
    if (!ok) {
      console.warn('[webhook] 401 — bad secret token');
      return res.status(401).json({ ok: false });
    }
  }
  // Acknowledge first so Telegram doesn't retry on slow handlers.
  res.json({ ok: true });
  try {
    const update = req.body as {
      message?: {
        text?: string;
        chat?: { id?: number };
        from?: {
          id?: number;
          first_name?: string;
          last_name?: string;
          username?: string;
          language_code?: string;
        };
      };
    };
    const msg = update.message;
    const text = msg?.text;
    const chatId = msg?.chat?.id;
    const from = msg?.from;
    if (!text || !chatId || !from?.id) return;

    const m = /^\/start(?:\s+(\S+))?/i.exec(text);
    if (!m) return;
    const param = m[1] ?? null;
    let referrer: number | null = null;
    if (param) {
      const refMatch = /^ref_(\d+)$/.exec(param);
      if (refMatch) referrer = Number(refMatch[1]);
    }

    touchUser(from.id, {
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
      languageCode: from.language_code,
      // Bot API /start updates don't carry photo_url — the mini-app
      // backfills it via /api/register when the player launches.
    });

    let linked = false;
    if (referrer !== null && referrer > 0 && referrer !== from.id) {
      addFriendship(from.id, referrer);
      linked = true;
    }
    console.log(
      `[webhook] /start from=${from.id} param=${param ?? '-'} linked=${linked}`,
    );

    const greeting = linked
      ? '🧮 Digits — щоденний математичний пазл.\nДруг тебе запросив — тапай «Грати», ваші результати будуть бачити одне одного.'
      : '🧮 Digits — щоденний математичний пазл.\nСьогоднішня задача готова. Тапай «Грати»:';
    await sendMessage(chatId, greeting, { openAppButton: 'Грати' });
  } catch (err) {
    console.error('[webhook] error', err);
  }
});

/** Header-based admin gate: prefer `Authorization: Bearer <ADMIN_TOKEN>`
 *  over a `?token=` query param so the secret never lands in access logs.
 *  Falls back to BOT_TOKEN with a warning while operators migrate. */
function adminAuthed(req: Request): boolean {
  const expected = ADMIN_TOKEN || BOT_TOKEN;
  if (!expected) return false;
  const header = req.header('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (m) {
    const got = m[1];
    if (
      got.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))
    ) {
      return true;
    }
  }
  // Legacy fallback — only honored when ADMIN_TOKEN is unset, so a deployment
  // that has rotated to a dedicated admin token can't be downgraded to using
  // the bot token via query string.
  if (!ADMIN_TOKEN) {
    const q =
      typeof req.query.token === 'string' ? (req.query.token as string) : '';
    if (
      q.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(q), Buffer.from(expected))
    ) {
      return true;
    }
  }
  return false;
}

/** Token-gated debug dump — used for operational sanity checks. */
app.get('/api/debug/stats', (req: Request, res: Response) => {
  if (!adminAuthed(req)) return res.status(401).json({ ok: false });
  const db = loadDB();
  return res.json({
    users: Object.keys(db.users).length,
    friendEdges: Object.fromEntries(
      Object.entries(db.friends).map(([k, v]) => [k, v.length]),
    ),
    resultsByDay: Object.fromEntries(
      Object.entries(db.results).map(([d, day]) => [d, Object.keys(day).length]),
    ),
  });
});

// Static files — bundle + serve.json headers.
const serveJsonPath = path.join(DIST, 'serve.json');
let serveConfig: {
  headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
} = {};
try {
  if (fs.existsSync(serveJsonPath)) {
    serveConfig = JSON.parse(fs.readFileSync(serveJsonPath, 'utf8'));
  }
} catch {
  // Ignore — fall back to default express static caching.
}

app.use(
  express.static(DIST, {
    setHeaders(res: Response, filePath: string) {
      if (!serveConfig.headers) return;
      const rel = path.relative(DIST, filePath).replace(/\\/g, '/');
      for (const rule of serveConfig.headers) {
        const re = new RegExp(
          '^' + rule.source.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$',
        );
        if (re.test(rel)) {
          for (const h of rule.headers) res.setHeader(h.key, h.value);
        }
      }
    },
  }),
);

// SPA fallback — any non-/api path returns index.html.
app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// --------------------------------------------------------------------------
// Daily broadcast cron — 09:30 Europe/Kyiv. Morning "coffee + puzzle" slot
// lands after the commute crush but before the workday fully ramps, which
// matches the engagement window observed on NYT-style daily puzzles.
// Skips anyone who has already finished today's puzzle to avoid pinging
// players who don't need a reminder.
// --------------------------------------------------------------------------
async function runDailyPush(): Promise<{ sent: number; skipped: number }> {
  const ids = allUserIds();
  if (ids.length === 0) return { sent: 0, skipped: 0 };
  const dateId = kyivIsoDate();
  const today = resultsOn(dateId);
  const text = `🧮 Digits на ${dateId}\nСьогоднішня задача вже готова — нова ціль і нові числа.`;
  let sent = 0;
  let skipped = 0;
  for (const id of ids) {
    if (today[id]) {
      skipped += 1;
      continue;
    }
    await sendMessage(id, text, { openAppButton: 'Грати' });
    sent += 1;
  }
  console.log(`[cron] daily push: sent=${sent} skipped=${skipped}`);
  return { sent, skipped };
}

cron.schedule('30 9 * * *', () => void runDailyPush(), { timezone: 'Europe/Kyiv' });

/** Manual trigger of the daily push, gated on the admin token so only the
 *  operator can fire it. Useful for verifying the cron pipeline outside of
 *  the 09:30 window. */
app.post('/api/debug/daily-push', async (req: Request, res: Response) => {
  if (!adminAuthed(req)) return res.status(401).json({ ok: false });
  const out = await runDailyPush();
  return res.json({ ok: true, ...out });
});

app.listen(PORT, () => {
  console.log(`[server] listening on :${PORT}, token=${BOT_TOKEN ? 'yes' : 'missing'}`);
});

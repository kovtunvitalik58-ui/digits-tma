const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL =
  process.env.APP_URL ?? 'https://digits-tma-production.up.railway.app';

if (!BOT_TOKEN) {
  console.warn('[telegram] BOT_TOKEN is not set — push notifications disabled.');
}

type SendMessageOptions = {
  parseMode?: 'HTML' | 'MarkdownV2';
  disableNotification?: boolean;
  /** If provided, the message gets a single "open mini-app" button that
   *  deep-links to the bot's main Mini App. */
  openAppButton?: string;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Fire-and-forget push to a single chat. Errors are swallowed — we never
 *  want a bad sendMessage to crash the whole daily broadcast. Honors
 *  Telegram's 429 `retry_after` once: a single retry is enough to ride out
 *  per-chat rate limits without piling up the worker. */
export async function sendMessage(
  chatId: string | number,
  text: string,
  opts: SendMessageOptions = {},
): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  if (opts.disableNotification) body.disable_notification = true;
  if (opts.openAppButton) {
    // `web_app` button type opens the URL inside Telegram's mini-app
    // viewer reliably across iOS / Android — `url` to t.me/<bot>/<app>
    // does the same on most clients but iOS sometimes does nothing on tap.
    body.reply_markup = {
      inline_keyboard: [
        [{ text: opts.openAppButton, web_app: { url: APP_URL } }],
      ],
    };
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return true;
      if (res.status === 429 && attempt === 0) {
        // Cap at 30s — anything longer means the bot is broadly rate-limited
        // and we'd rather drop this push than block the worker further.
        const wait = await readRetryAfter(res);
        if (wait <= 30_000) {
          await sleep(wait);
          continue;
        }
      }
      console.warn(`[telegram] sendMessage ${chatId} → ${res.status}`);
      return false;
    } catch (err) {
      console.warn('[telegram] sendMessage failed', err);
      return false;
    }
  }
  return false;
}

async function readRetryAfter(res: Response): Promise<number> {
  // Telegram puts retry_after in the JSON body's `parameters`. Header is also
  // sometimes set — fall back to it.
  try {
    const data = (await res.json()) as {
      parameters?: { retry_after?: number };
    };
    const ra = data.parameters?.retry_after;
    if (typeof ra === 'number' && ra > 0) return ra * 1000;
  } catch {
    // ignore parse errors
  }
  const header = res.headers.get('retry-after');
  const n = header ? Number(header) : NaN;
  if (Number.isFinite(n) && n > 0) return n * 1000;
  return 1000;
}

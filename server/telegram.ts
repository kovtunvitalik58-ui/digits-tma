const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.VITE_BOT_USERNAME ?? process.env.BOT_USERNAME;
const APP_NAME = process.env.VITE_APP_NAME ?? process.env.APP_NAME ?? 'play';
const APP_URL =
  process.env.APP_URL ?? 'https://digits-tma-production.up.railway.app';
void BOT_USERNAME;
void APP_NAME;

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

/** Fire-and-forget push to a single chat. Errors are swallowed — we never
 *  want a bad sendMessage to crash the whole daily broadcast. */
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
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`[telegram] sendMessage ${chatId} → ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[telegram] sendMessage failed', err);
    return false;
  }
}

import crypto from 'node:crypto';

/** Validate a Telegram WebApp initData string against the bot token.
 *  Returns the parsed `user` object if valid, or null otherwise.
 *  https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 60 * 60 * 24,
): TelegramUser | null {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
  if (computed !== hash) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate) return null;
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > maxAgeSeconds) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw) as TelegramUser;
  } catch {
    return null;
  }
}

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

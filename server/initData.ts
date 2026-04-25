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
  // timingSafeEqual on equal-length hex strings; computed is always 64 hex
  // chars but a forged `hash` could be any length, so guard explicitly.
  if (
    hash.length !== computed.length ||
    !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'))
  ) {
    return null;
  }

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

/** Allow-list of hosts Telegram uses for user avatars. Anything else gets
 *  dropped — the avatar value flows straight into an `<img src>` on the
 *  client, so we don't trust an attacker-controlled URL even if `initData`
 *  was somehow forged. */
const TG_AVATAR_HOSTS = new Set([
  't.me',
  'telegram.org',
  'cdn1.telegram-cdn.org',
  'cdn2.telegram-cdn.org',
  'cdn3.telegram-cdn.org',
  'cdn4.telegram-cdn.org',
  'cdn5.telegram-cdn.org',
]);

function safePhotoUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return undefined;
    if (!TG_AVATAR_HOSTS.has(u.hostname)) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Capture every profile-shaped field from the validated Telegram user
 *  in one shot — every register/result handler does the same dance, so
 *  it lives here. */
export function profileInfo(user: TelegramUser): {
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
} {
  return {
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    photoUrl: safePhotoUrl(user.photo_url),
    languageCode: user.language_code,
  };
}

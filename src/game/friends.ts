import { APP_NAME, BOT_USERNAME } from '../lib/config';

/** Prefix used in the `start_param` query param for referrals.
 *  Format: `ref_<telegramUserId>`. Keep it short — Telegram allows ≤ 64 chars. */
const REF_PREFIX = 'ref_';

/** Build the shareable deep-link that carries the inviter's Telegram ID.
 *  Uses the classic `?start=ref_<id>` bot-command form so it lands at the
 *  bot webhook (which records the friendship server-side and replies with
 *  a "Грати" mini-app launch button). The mini-app `?startapp=` direct
 *  link silently drops the parameter unless the bot is configured as a
 *  Direct Link Mini App in BotFather. */
export function buildReferralUrl(inviterId: number | null): string {
  if (inviterId === null) return `https://t.me/${BOT_USERNAME}/${APP_NAME}`;
  return `https://t.me/${BOT_USERNAME}?start=${REF_PREFIX}${inviterId}`;
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

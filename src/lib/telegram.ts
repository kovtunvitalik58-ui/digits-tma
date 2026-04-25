// Thin wrapper around window.Telegram.WebApp.
// Works outside Telegram too (all calls become no-ops), so dev in browser just works.

export function tg(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/** Current user's Telegram ID (or null if running outside Telegram). */
export function getUserId(): number | null {
  return tg()?.initDataUnsafe?.user?.id ?? null;
}

/** Raw Telegram user object, or null outside Telegram. */
export function getUser(): TelegramUser | null {
  return tg()?.initDataUnsafe?.user ?? null;
}

/** Human-friendly display name, prefers first+last, falls back to @username. */
export function getUserDisplayName(): string {
  const u = getUser();
  if (!u) return 'Ти';
  const parts = [u.first_name, u.last_name].filter(Boolean) as string[];
  if (parts.length) return parts.join(' ');
  if (u.username) return '@' + u.username;
  return 'Ти';
}

/** `start_param` set by the t.me/.../play?startapp=... link — used for referrals. */
export function getStartParam(): string | null {
  return tg()?.initDataUnsafe?.start_param ?? null;
}

/** Chat context: stable per chat where the app was opened from.
 *  Useful for per-chat leaderboards. */
export function getChatInstance(): string | null {
  return tg()?.initDataUnsafe?.chat_instance ?? null;
}

function versionAtLeast(min: [number, number]): boolean {
  const app = tg();
  if (!app) return false;
  const parts = (app.version || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  return major > min[0] || (major === min[0] && minor >= min[1]);
}

export function initTelegram(): void {
  const app = tg();
  if (!app) return;
  try {
    app.ready();
    app.expand();
  } catch {
    // no-op
  }
  // Header/background color customization shipped in v6.1.
  if (versionAtLeast([6, 1])) {
    try {
      app.setHeaderColor('#0f172a');
      app.setBackgroundColor('#0f172a');
    } catch {
      // swallow — older clients may still reject unknown colors
    }
  }
}

function hapticSupported(): boolean {
  return !!tg()?.HapticFeedback && versionAtLeast([6, 1]);
}

export const haptic = {
  tap(): void {
    if (hapticSupported()) tg()!.HapticFeedback.impactOccurred('light');
  },
  pick(): void {
    if (hapticSupported()) tg()!.HapticFeedback.selectionChanged();
  },
  success(): void {
    if (hapticSupported()) tg()!.HapticFeedback.notificationOccurred('success');
  },
  warn(): void {
    if (hapticSupported()) tg()!.HapticFeedback.notificationOccurred('warning');
  },
  error(): void {
    if (hapticSupported()) tg()!.HapticFeedback.notificationOccurred('error');
  },
  heavy(): void {
    if (hapticSupported()) tg()!.HapticFeedback.impactOccurred('heavy');
  },
};

/** Open the Telegram share picker with a pre-filled message.
 *  Falls back to Web Share API / clipboard when running outside Telegram.
 *
 *  If `url` is provided, it gets embedded at the end of the message text
 *  rather than passed via share/url's `url=` parameter. The `url=` channel
 *  produces a URL entity that some Telegram clients (notably older iOS)
 *  fail to relay as a clickable link to the recipient — plain-text URL
 *  auto-linkification works on every client. */
export async function shareResult(text: string, url?: string): Promise<'telegram' | 'web-share' | 'clipboard' | 'unsupported'> {
  const fullText = url ? `${text}\n${url}` : text;
  const app = tg();
  if (app?.openTelegramLink) {
    // URLSearchParams encodes spaces as `+`, which Telegram's share endpoint
    // renders literally. encodeURIComponent keeps `%20` so the message reads
    // as written. We still pass `url=` (Telegram requires a non-empty value
    // for the share dialog to open reliably) but make it match what's already
    // inline in the text — the client dedupes when composing the message.
    const u = encodeURIComponent(url ?? text);
    const t = encodeURIComponent(fullText);
    app.openTelegramLink(`https://t.me/share/url?url=${u}&text=${t}`);
    return 'telegram';
  }
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ text: fullText });
      return 'web-share';
    } catch {
      // user cancelled or not allowed — fall through
    }
  }
  try {
    await navigator.clipboard?.writeText(fullText);
    return 'clipboard';
  } catch {
    return 'unsupported';
  }
}

// CloudStorage as Promises + localStorage fallback for browser dev or
// older Telegram clients (CloudStorage shipped in WebApp v6.9).
const LS_PREFIX = 'digits:';

function cloudStorageSupported(): boolean {
  return !!tg()?.CloudStorage && versionAtLeast([6, 9]);
}

// Some Telegram clients (seen on iOS) accept a CloudStorage call but never
// invoke the callback. Without a deadline the calling promise would hang
// forever and any `await storage.get(...)` would block its caller — which
// used to manifest as an empty, frozen leaderboard.
const CLOUD_TIMEOUT_MS = 1500;

export const storage = {
  async get(key: string): Promise<string | null> {
    if (cloudStorageSupported()) {
      const cloud = new Promise<string | null>((resolve) => {
        try {
          tg()!.CloudStorage.getItem(key, (err, value) => {
            if (err) resolve(null);
            else resolve(value || null);
          });
        } catch {
          resolve(localStorage.getItem(LS_PREFIX + key));
        }
      });
      const deadline = new Promise<string | null>((resolve) =>
        setTimeout(() => resolve(localStorage.getItem(LS_PREFIX + key)), CLOUD_TIMEOUT_MS),
      );
      return Promise.race([cloud, deadline]);
    }
    return localStorage.getItem(LS_PREFIX + key);
  },

  async set(key: string, value: string): Promise<void> {
    // Always mirror into localStorage so a later `get` has a fallback even
    // if CloudStorage silently drops the write.
    localStorage.setItem(LS_PREFIX + key, value);
    if (cloudStorageSupported()) {
      return new Promise((resolve) => {
        try {
          tg()!.CloudStorage.setItem(key, value, () => resolve());
          setTimeout(resolve, CLOUD_TIMEOUT_MS);
        } catch {
          resolve();
        }
      });
    }
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await storage.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJSON<T>(key: string, value: T): Promise<void> {
    await storage.set(key, JSON.stringify(value));
  },

  /** Wipe every key the app has written to this user's storage. Used by the
   *  `startapp=reset` debug entrypoint — a clean way to test first-open
   *  flows without asking the player to reinstall anything. */
  async clearAll(): Promise<void> {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    if (!cloudStorageSupported()) return;
    await new Promise<void>((resolve) => {
      const deadline = setTimeout(resolve, CLOUD_TIMEOUT_MS);
      try {
        tg()!.CloudStorage.getKeys((err, keys) => {
          if (err || !keys || keys.length === 0) {
            clearTimeout(deadline);
            return resolve();
          }
          let pending = keys.length;
          keys.forEach((k) =>
            tg()!.CloudStorage.removeItem(k, () => {
              if (--pending === 0) {
                clearTimeout(deadline);
                resolve();
              }
            }),
          );
        });
      } catch {
        clearTimeout(deadline);
        resolve();
      }
    });
  },
};

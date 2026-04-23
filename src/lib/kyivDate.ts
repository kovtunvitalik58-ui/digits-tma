/**
 * All daily boundaries in the game are anchored to Europe/Kyiv so every player
 * sees "today's puzzle" roll over at the same wall clock, no matter where
 * their phone says it is. DST (EET ↔ EEST) is handled for free by Intl.
 */

const ZONE = 'Europe/Kyiv';

const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  weekday: 'short',
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** `YYYY-MM-DD` for the given instant, computed in Europe/Kyiv. */
export function kyivIsoDate(d: Date = new Date()): string {
  // en-CA naturally produces YYYY-MM-DD.
  return isoFormatter.format(d);
}

/** 0..6 (Sun..Sat) for the given instant in Europe/Kyiv. */
export function kyivDayOfWeek(d: Date = new Date()): number {
  return WEEKDAY_INDEX[weekdayFormatter.format(d)] ?? 0;
}

/** Calendar day before `isoDate` (which must be `YYYY-MM-DD`). Pure date math,
 *  safe across DST since we never cross a local midnight during the subtract. */
export function prevIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map((n) => parseInt(n, 10));
  // Build a UTC timestamp for the given calendar day, step one day back,
  // and re-format. The UTC anchor is just a counter — it never enters output.
  const t = Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000;
  const prev = new Date(t);
  return (
    `${prev.getUTCFullYear()}-` +
    `${String(prev.getUTCMonth() + 1).padStart(2, '0')}-` +
    `${String(prev.getUTCDate()).padStart(2, '0')}`
  );
}

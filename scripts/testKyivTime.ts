/**
 * Verifies the daily-boundary logic is anchored to Europe/Kyiv and survives:
 *   - a user whose phone clock says UTC (+0)
 *   - a user in Los Angeles (UTC-7/-8)
 *   - a user in Tokyo (UTC+9)
 *   - a puzzle/undo rollover at Kyiv midnight
 *   - DST transitions (winter EET / summer EEST)
 *
 * Run: npx tsx scripts/testKyivTime.ts
 */
import { kyivDayOfWeek, kyivIsoDate, prevIsoDate } from '../src/lib/kyivDate';
import { todayPuzzle, difficultyFor } from '../src/game/generator';
import { recordDailySolve } from '../src/game/stats';

let fails = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '✓' : '✗'} ${name}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
  if (!ok) fails += 1;
}

// ── Known instants, cross-checked against public Kyiv-time converters ──
// Each `Date(iso)` is absolute UTC — output should reflect Kyiv wall clock.

// 2026-04-23 19:19 Kyiv = 16:19 UTC (EEST = UTC+3)
check(
  'summer evening Kyiv date',
  kyivIsoDate(new Date('2026-04-23T16:19:00Z')),
  '2026-04-23',
);
check(
  'summer evening Kyiv weekday (Thu=4)',
  kyivDayOfWeek(new Date('2026-04-23T16:19:00Z')),
  4,
);

// 2026-04-23 23:59 Kyiv = 20:59 UTC — still Thursday
check(
  'just-before-midnight Kyiv still today',
  kyivIsoDate(new Date('2026-04-23T20:59:00Z')),
  '2026-04-23',
);
// Same instant + 2 minutes = 21:01 UTC = 00:01 Kyiv on the 24th
check(
  'just-after-midnight Kyiv is tomorrow',
  kyivIsoDate(new Date('2026-04-23T21:01:00Z')),
  '2026-04-24',
);

// Winter: 2026-01-15 06:00 Kyiv = 04:00 UTC (EET = UTC+2)
check(
  'winter morning Kyiv date',
  kyivIsoDate(new Date('2026-01-15T04:00:00Z')),
  '2026-01-15',
);

// User in LA: 22:00 PDT on 2026-04-23 = 05:00 UTC on 2026-04-24 = 08:00 Kyiv on 2026-04-24
check(
  'LA user near local midnight sees NEXT Kyiv day',
  kyivIsoDate(new Date('2026-04-24T05:00:00Z')),
  '2026-04-24',
);

// User in Tokyo at 02:00 JST on 2026-04-24 = 17:00 UTC on 2026-04-23 = 20:00 Kyiv 23rd
check(
  'Tokyo user early morning sees CURRENT Kyiv day',
  kyivIsoDate(new Date('2026-04-23T17:00:00Z')),
  '2026-04-23',
);

// prevIsoDate: across month boundary
check('prev of 2026-05-01', prevIsoDate('2026-05-01'), '2026-04-30');
// across year boundary
check('prev of 2026-01-01', prevIsoDate('2026-01-01'), '2025-12-31');
// Through leap day (2028 is leap)
check('prev of 2028-03-01', prevIsoDate('2028-03-01'), '2028-02-29');

// ── Puzzle determinism by Kyiv date ──
const atMorning = new Date('2026-04-23T07:00:00Z'); // 10:00 Kyiv
const atEvening = new Date('2026-04-23T20:00:00Z'); // 23:00 Kyiv
const pA = todayPuzzle(atMorning);
const pB = todayPuzzle(atEvening);
check('same Kyiv day → same puzzle id', pA.id, pB.id);
check('same Kyiv day → same numbers', pA.numbers, pB.numbers);
check('same Kyiv day → same target', pA.target, pB.target);

// Two instants: 23:30 Kyiv yesterday and 00:30 Kyiv today should differ
const late = new Date('2026-04-23T20:30:00Z'); // 23:30 Kyiv 23rd
const early = new Date('2026-04-23T21:30:00Z'); // 00:30 Kyiv 24th
check('late-night Kyiv puzzle id', todayPuzzle(late).id, '2026-04-23');
check('after-midnight Kyiv puzzle id', todayPuzzle(early).id, '2026-04-24');

// Difficulty for Thursday (2026-04-23) should be 4 per the curve.
check('Thursday difficulty', difficultyFor(new Date('2026-04-23T10:00:00Z')), 4);
// Sunday (2026-04-26)
check('Sunday difficulty', difficultyFor(new Date('2026-04-26T10:00:00Z')), 3);
// Saturday (2026-04-25)
check('Saturday difficulty', difficultyFor(new Date('2026-04-25T10:00:00Z')), 5);

// ── Streak rollover using Kyiv days ──
const stats0 = { solved: 0, streak: 0, bestStreak: 0, totalStars: 0, lastDaily: null };
// User solves on 2026-04-22 Kyiv (15:00 UTC = 18:00 Kyiv)
const s1 = recordDailySolve(stats0, 3, new Date('2026-04-22T15:00:00Z'));
check('first solve date', s1.lastDaily, '2026-04-22');
check('first solve streak=1', s1.streak, 1);

// Next day 22:00 UTC = 01:00 Kyiv on the 24th — NOT consecutive (skipped 23rd)
const s2skip = recordDailySolve(s1, 2, new Date('2026-04-23T22:00:00Z'));
check('skipped Kyiv day resets streak', s2skip.streak, 1);

// Consecutive Kyiv day (23rd at 18:00 Kyiv) — should keep the streak going
const s2ok = recordDailySolve(s1, 2, new Date('2026-04-23T15:00:00Z'));
check('next Kyiv day streak=2', s2ok.streak, 2);
check('next Kyiv day date', s2ok.lastDaily, '2026-04-23');

// Same-day replay is a no-op
const s2same = recordDailySolve(s2ok, 3, new Date('2026-04-23T20:00:00Z'));
check('same-day replay does not double-count', s2same.streak, 2);
check('same-day replay keeps date', s2same.lastDaily, '2026-04-23');

console.log();
if (fails > 0) {
  console.error(`${fails} check(s) failed`);
  process.exit(1);
}
console.log('All checks passed');

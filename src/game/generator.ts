import type { Puzzle } from './types.js';
import { solve, reachableValues } from './solver.js';
import { kyivDayOfWeek, kyivIsoDate } from '../lib/kyivDate.js';

type GenOptions = {
  /** How many starters (NYT uses 6). */
  count?: number;
  /** Target difficulty, in minimum solution steps. */
  minSteps: number;
  /** Seed id to make the puzzle reproducible (e.g. YYYY-MM-DD). */
  seed?: string;
  /** Max tries before giving up and returning the best candidate we found. */
  tries?: number;
};

/** Deterministic RNG so daily puzzles are stable across devices. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * NYT-style small-number pool. The game mixes small units with occasional
 * larger multiples of 5/10/25 to make multiplication paths interesting.
 */
const SMALL_POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const MEDIUM_POOL = [10, 11, 12, 13, 15, 20, 25];
const LARGE_POOL = [50, 75, 100];

function drawStarters(rng: () => number, count: number): number[] {
  const out: number[] = [];
  // Rough shape: ~4 small, ~1–2 medium, occasional large.
  for (let i = 0; i < count; i += 1) {
    const roll = rng();
    if (roll < 0.55) out.push(pick(SMALL_POOL, rng));
    else if (roll < 0.9) out.push(pick(MEDIUM_POOL, rng));
    else out.push(pick(LARGE_POOL, rng));
  }
  return out;
}

/**
 * Pick a target reachable in EXACTLY `minSteps` ops from `numbers`.
 * Prefers targets that look "round" or memorable — NYT often uses targets
 * like 142, 207, 325, not random primes. Falls back to any reachable target
 * rather than failing, so the generator can almost always produce something.
 */
function chooseTarget(numbers: number[], minSteps: number, rng: () => number): number | null {
  const reachable = reachableValues(numbers);
  const preferred: Array<{ v: number; score: number }> = [];
  const acceptable: Array<{ v: number; score: number }> = [];

  for (const [value, steps] of reachable) {
    if (steps !== minSteps) continue;
    if (value < 10 || value > 999) continue;
    if (numbers.includes(value)) continue;

    let score = rng() * 2;
    if (value % 10 === 0) score += 3;
    else if (value % 5 === 0) score += 2;
    if (value >= 100 && value <= 500) score += 2;
    const entry = { v: value, score };

    if (value >= 20 && value <= 999) preferred.push(entry);
    acceptable.push(entry);
  }

  const pool = preferred.length > 0 ? preferred : acceptable;
  if (pool.length === 0) return null;
  pool.sort((a, b) => b.score - a.score);
  const top = pool.slice(0, Math.min(10, pool.length));
  return pick(top, rng).v;
}

export function generatePuzzle({
  count = 6,
  minSteps,
  seed,
  tries = 50,
}: GenOptions): Puzzle {
  const id = seed ?? `rand-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const rng = mulberry32(hashSeed(id));

  // Pass 1 — strict: require exact `minSteps` match. Most days resolve here.
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const numbers = drawStarters(rng, count);
    const target = chooseTarget(numbers, minSteps, rng);
    if (target === null) continue;

    const sample = solve(numbers, target, { maxSolutions: 5 });
    if (sample.length === 0) continue;

    const actualMin = sample[0].length;
    if (actualMin !== minSteps) continue;

    return { id, numbers, target, minSteps: actualMin, solutionsSample: sample };
  }

  // Pass 2 — lenient: a small fraction of seeds (~3% sampled across 60 days)
  // never roll starters that admit a target reachable in EXACTLY `minSteps`,
  // which used to dump every player onto the canned 142-puzzle for that
  // calendar day. Accept ±1 step rather than that. The +1 branch comes
  // first so the fallback errs harder, not easier, than the requested
  // difficulty curve.
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const numbers = drawStarters(rng, count);
    for (const ms of [minSteps + 1, minSteps - 1]) {
      if (ms < 2) continue;
      const target = chooseTarget(numbers, ms, rng);
      if (target === null) continue;
      const sample = solve(numbers, target, { maxSolutions: 5 });
      if (sample.length === 0) continue;
      if (sample[0].length !== ms) continue;
      console.warn(
        `[generator] strict pass missed for seed=${seed ?? id} ` +
          `minSteps=${minSteps}; serving ${ms}-step puzzle from lenient pass`,
      );
      return { id, numbers, target, minSteps: sample[0].length, solutionsSample: sample };
    }
  }

  // Fallback: verified hand-crafted puzzle so the UI never shows a broken state.
  // 25 × 5 = 125;  125 + 10 = 135;  135 + 7 = 142  (exactly 3 ops)
  console.warn(
    `[generator] falling back to canned puzzle for seed=${seed ?? id} ` +
      `minSteps=${minSteps} after ${tries * 2} unsuccessful tries (strict + lenient)`,
  );
  return {
    id: `${id}-fallback`,
    numbers: [2, 3, 5, 7, 10, 25],
    target: 142,
    minSteps: 3,
    solutionsSample: [
      [
        { a: 25, b: 5, op: '*', result: 125 },
        { a: 125, b: 10, op: '+', result: 135 },
        { a: 135, b: 7, op: '+', result: 142 },
      ],
    ],
  };
}

/** Difficulty curve by weekday — gentle NYT-style ramp: Sun-Mon easy,
 *  Tue through Sat stay at 4 ops. Previously peaked at 5, which meant the
 *  player had to use five of six cards and often ran out of viable paths.
 *  Weekday is resolved in Europe/Kyiv so every player rolls over together. */
export function difficultyFor(date: Date = new Date()): number {
  const day = kyivDayOfWeek(date); // 0 Sun .. 6 Sat, in Kyiv
  return [3, 3, 4, 4, 4, 4, 4][day];
}

/** The daily puzzle for "today in Kyiv". Deterministic per Kyiv-date, so the
 *  same puzzle is seen by everyone between local 00:00 and 24:00 in Kyiv. */
export function todayPuzzle(now: Date = new Date()): Puzzle {
  const seed = kyivIsoDate(now);
  return generatePuzzle({ minSteps: difficultyFor(now), seed });
}

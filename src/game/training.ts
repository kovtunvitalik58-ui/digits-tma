import type { Puzzle } from './types.js';
import { difficultyFor, generatePuzzle } from './generator.js';

/** Stable key for a {numbers, target} pair — order-insensitive on numbers
 *  so the same multiset always maps to the same string. App.tsx persists
 *  the most recent of these to keep training non-repeating. */
export function puzzleSignature(p: Pick<Puzzle, 'numbers' | 'target'>): string {
  return [...p.numbers].sort((a, b) => a - b).join(',') + '|' + p.target;
}

/** How many seeds to try before giving up and serving a possibly-repeating
 *  puzzle. With a recently-seen set capped at 100 and a much wider puzzle
 *  pool than that, collisions are rare and 30 attempts is overkill in
 *  practice — but cheap insurance against pathological seeds. */
const MAX_NON_REPEAT_TRIES = 30;

/** Generate a training puzzle that doesn't match anything in `seenSigs`.
 *  Same six-card shape and difficulty curve as today's daily; lives in a
 *  separate `train-…` seed namespace so the hash never lines up with a
 *  daily. `counter` should monotonically increase per player so two
 *  consecutive trainings never share the same starting seed. */
export function trainingPuzzle(
  userId: number | null,
  counter: number,
  seenSigs: ReadonlySet<string> = new Set(),
): Puzzle {
  const minSteps = difficultyFor();
  const namespace = `train-${userId ?? 'anon'}-${counter}`;
  for (let attempt = 0; attempt < MAX_NON_REPEAT_TRIES; attempt += 1) {
    const p = generatePuzzle({ minSteps, seed: `${namespace}-${attempt}` });
    if (!seenSigs.has(puzzleSignature(p))) return p;
  }
  // Last-resort: with 30 tries against ≤ 100 seen signatures the odds of
  // every attempt landing on a repeat are negligible, but the type system
  // insists on a Puzzle here.
  return generatePuzzle({ minSteps, seed: `${namespace}-fallback` });
}

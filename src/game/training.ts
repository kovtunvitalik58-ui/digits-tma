import type { Puzzle } from './types.js';
import { difficultyFor, generatePuzzle } from './generator.js';

/** Generate a single training puzzle. Same shape as today's daily — six
 *  cards, today's difficulty curve — so the player feels at home, but the
 *  seed lives in a separate `train-…` namespace from daily seeds, so the
 *  hash never lines up byte-for-byte with a future daily. There's still a
 *  small statistical chance the generator independently picks the same
 *  {numbers, target} combo as a future daily (~0.7% per training based on
 *  the puzzle space), which we accept rather than burning ~1.5 s on a
 *  look-ahead check that would only protect a handful of days. */
export function trainingPuzzle(userId: number | null, counter: number): Puzzle {
  return generatePuzzle({
    minSteps: difficultyFor(),
    seed: `train-${userId ?? 'anon'}-${counter}`,
  });
}

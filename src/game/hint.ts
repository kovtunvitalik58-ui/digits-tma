import type { Op, PuzzleState } from './types.js';
import { solve } from './solver.js';

export type Hint = { leftId: string; rightId: string; op: Op };

/** Compute the next move that takes the player toward the target from the
 *  CURRENT board state — re-solves from whatever cards are still alive
 *  rather than relying on `puzzle.solutionsSample`, which is frozen at
 *  generation time and goes stale after the first move. Picks the first
 *  step of the shortest solution. Returns null when no solution remains
 *  (player has worked themselves into an unwinnable corner).
 *
 *  Two cards with the same value are interchangeable for the engine, so
 *  when the suggested step is e.g. `8 + 8`, we pick any two distinct card
 *  ids that match — both highlight identically on screen. */
export function nextHint(state: PuzzleState): Hint | null {
  const alive = state.cards.filter((c) => !c.used);
  if (alive.length < 2) return null;
  const values = alive.map((c) => c.value);
  const solutions = solve(values, state.puzzle.target, { maxSolutions: 1 });
  if (solutions.length === 0) return null;
  const step = solutions[0][0];
  if (!step) return null;
  const left = alive.find((c) => c.value === step.a);
  if (!left) return null;
  const right = alive.find((c) => c.value === step.b && c.id !== left.id);
  if (!right) return null;
  return { leftId: left.id, rightId: right.id, op: step.op };
}

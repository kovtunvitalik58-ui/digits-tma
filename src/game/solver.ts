import type { Op, SolutionStep } from './types.js';
import { OPS, apply, isCommutative } from './ops.js';

type SolveOptions = {
  maxSolutions?: number;
};

/**
 * Finds solutions that reach `target` exactly. Returns up to `maxSolutions`
 * distinct step-sequences, ordered by length (shortest first).
 */
export function solve(
  numbers: readonly number[],
  target: number,
  { maxSolutions = 20 }: SolveOptions = {},
): SolutionStep[][] {
  const results: SolutionStep[][] = [];
  const seenSolutions = new Set<string>();

  function recurse(nums: number[], path: SolutionStep[]): void {
    if (results.length >= maxSolutions) return;

    if (nums.includes(target)) {
      const key = path
        .map((s) => `${s.a}${s.op}${s.b}=${s.result}`)
        .sort()
        .join('|');
      if (!seenSolutions.has(key)) {
        seenSolutions.add(key);
        results.push([...path]);
      }
      return;
    }
    if (nums.length === 1) return;

    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        const a = nums[i];
        const b = nums[j];
        for (const op of OPS) {
          if (isCommutative(op) && i > j) continue;
          const r = apply(a, b, op);
          if (r === null) continue;
          const next = nums.slice();
          next.splice(Math.max(i, j), 1);
          next.splice(Math.min(i, j), 1);
          next.push(r);
          path.push({ a, b, op, result: r });
          recurse(next, path);
          path.pop();
          if (results.length >= maxSolutions) return;
        }
      }
    }
  }

  recurse(numbers.slice(), []);

  results.sort((a, b) => a.length - b.length);
  return results;
}

/**
 * Returns the set of every value reachable from `numbers` via valid operations.
 * Used by the puzzle generator to pick good targets.
 */
export function reachableValues(
  numbers: readonly number[],
  maxDepth: number = Infinity,
): Map<number, number> {
  const bestSteps = new Map<number, number>();

  function recurse(nums: number[], depth: number): void {
    for (const v of nums) {
      const prev = bestSteps.get(v);
      if (prev === undefined || depth < prev) bestSteps.set(v, depth);
    }
    // Stop expanding once we've reached the deepest step count the caller
    // cares about. The puzzle generator only consumes results where
    // `steps === minSteps`, so exploring beyond that is pure waste — and on
    // some seeds (notably 2026-04-26 with starters {2,9,20,7,12,7}) the full
    // walk takes 10+ seconds in Vite dev / ~1 s in production. Capping the
    // depth at minSteps cuts that to well under 200 ms in dev.
    if (depth >= maxDepth || nums.length === 1) return;

    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        const a = nums[i];
        const b = nums[j];
        for (const op of OPS) {
          if (isCommutative(op) && i > j) continue;
          const r = apply(a, b, op);
          if (r === null) continue;
          const next = nums.slice();
          next.splice(Math.max(i, j), 1);
          next.splice(Math.min(i, j), 1);
          next.push(r);
          recurse(next, depth + 1);
        }
      }
    }
  }

  recurse(numbers.slice(), 0);
  return bestSteps;
}

export function describeStep(step: SolutionStep): string {
  const ops: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  return `${step.a} ${ops[step.op]} ${step.b} = ${step.result}`;
}

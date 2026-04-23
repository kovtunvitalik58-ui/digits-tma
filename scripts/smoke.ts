/**
 * Quick sanity-check for the game core. Run with:
 *   npx tsx scripts/smoke.ts
 *
 * (No Node-only imports, so no tsx needed if Node has native TS — but tsx is simplest.)
 */
import { solve, reachableValues } from '../src/game/solver';
import { generatePuzzle, todayPuzzle } from '../src/game/generator';
import { apply } from '../src/game/ops';
import { doOp, initState } from '../src/game/engine';

function log(label: string, v: unknown): void {
  console.log(`\n— ${label} —`);
  console.log(v);
}

// Sanity: the NYT-illustrative 142 from {1,2,3,4,5,6} (an easy set)
const numbers = [1, 2, 3, 4, 5, 25];
const target = 100;
log('solve(1,2,3,4,5,25 -> 100)', solve(numbers, target, { maxSolutions: 3 }));

// reachableValues returns {value -> min steps}
const reach = reachableValues([2, 3, 5]);
log('reachable from {2,3,5} (sample)', Array.from(reach.entries()).slice(0, 15));

// Generator deterministic
const p1 = generatePuzzle({ minSteps: 3, seed: '2026-04-23' });
const p2 = generatePuzzle({ minSteps: 3, seed: '2026-04-23' });
log('deterministic?', {
  sameNumbers: JSON.stringify(p1.numbers) === JSON.stringify(p2.numbers),
  sameTarget: p1.target === p2.target,
  numbers: p1.numbers,
  target: p1.target,
  minSteps: p1.minSteps,
  firstSolution: p1.solutionsSample[0],
});

// End-to-end: play one optimal solve and check state ends solved.
const puzzle = p1;
let state = initState(puzzle);
const sol = puzzle.solutionsSample[0];
console.log(`\n— playing solution for ${puzzle.numbers} -> ${puzzle.target} —`);
for (const step of sol) {
  const aCard = state.cards.find((c) => c.value === step.a);
  const bCard = state.cards.find((c) => c.value === step.b && c.id !== aCard?.id);
  if (!aCard || !bCard) {
    console.log('  could not locate cards for step', step, state.cards.map((c) => c.value));
    break;
  }
  const res = doOp(state, aCard.id, bCard.id, step.op);
  if (!res.ok) {
    console.log('  op failed:', step, res.reason);
    break;
  }
  state = res.next;
  console.log(`  ${step.a} ${step.op} ${step.b} = ${step.result}  status=${state.status} stars=${state.stars}`);
}

// Today
const today = todayPuzzle();
log('todayPuzzle()', { id: today.id, numbers: today.numbers, target: today.target, minSteps: today.minSteps });

// ops micro
log('apply(10 / 3)', apply(10, 3, '/'));
log('apply(10 / 5)', apply(10, 5, '/'));
log('apply(3 - 5)', apply(3, 5, '-'));

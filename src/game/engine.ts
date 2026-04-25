import type { GameStatus, NumberCard, Op, Puzzle, PuzzleState, Stars, Step } from './types.js';
import { apply } from './ops.js';

/** Convert distance-from-target into a 0..3 star rank.
 *  3★ exact, 2★ within 10, 1★ within 20, 0★ further away. */
export function starsForDistance(distance: number): Stars {
  if (distance === 0) return 3;
  if (distance <= 10) return 2;
  if (distance <= 20) return 1;
  return 0;
}

/** Distance of the closest ACTIVE card to the target. Infinity if the board has none. */
export function bestDistance(cards: NumberCard[], target: number): number {
  let best = Infinity;
  for (const c of cards) {
    if (c.used) continue;
    const d = Math.abs(c.value - target);
    if (d < best) best = d;
  }
  return best;
}

let _idSeq = 0;
export function newCardId(): string {
  _idSeq += 1;
  return `c${_idSeq}`;
}

let _bornSeq = 0;
function nextBornAt(): number {
  _bornSeq += 1;
  return _bornSeq;
}

export function cardsFromNumbers(numbers: number[]): NumberCard[] {
  return numbers.map((value) => ({ id: newCardId(), value, bornAt: nextBornAt(), used: false }));
}

export function activeCards(cards: NumberCard[]): NumberCard[] {
  return cards.filter((c) => !c.used);
}

export function initState(puzzle: Puzzle): PuzzleState {
  return {
    puzzle,
    cards: cardsFromNumbers(puzzle.numbers),
    history: [],
    status: 'playing',
    stars: 0,
  };
}

export type DoOpResult =
  | { ok: true; next: PuzzleState }
  | { ok: false; reason: string };

/** Apply `left op right` — marks both cards as used, appends a fresh result card,
 *  and records a snapshot for undo. Used cards stay in the board so the player
 *  keeps the full trail of what they've consumed. */
export function doOp(state: PuzzleState, leftId: string, rightId: string, op: Op): DoOpResult {
  if (state.status !== 'playing') return { ok: false, reason: 'Гра закінчена' };
  if (leftId === rightId) return { ok: false, reason: 'Потрібні різні числа' };

  const left = state.cards.find((c) => c.id === leftId);
  const right = state.cards.find((c) => c.id === rightId);
  if (!left || !right) return { ok: false, reason: 'Картку не знайдено' };
  if (left.used || right.used) return { ok: false, reason: 'Число вже використане' };

  const result = apply(left.value, right.value, op);
  if (result === null) return { ok: false, reason: failReason(op) };

  const before = state.cards.map((c) => ({ ...c }));
  const resultCard: NumberCard = {
    id: newCardId(),
    value: result,
    bornAt: nextBornAt(),
    used: false,
  };
  const nextCards: NumberCard[] = state.cards
    .map((c) => (c.id === leftId || c.id === rightId ? { ...c, used: true } : c))
    .concat(resultCard);

  const step: Step = {
    leftId,
    rightId,
    op,
    resultId: resultCard.id,
    resultValue: result,
    before,
  };

  const history = [...state.history, step];
  const alive = nextCards.filter((c) => !c.used);
  const dist = bestDistance(alive, state.puzzle.target);
  const outOfMoves = alive.length < 2;
  const reachedTarget = dist === 0;
  // Auto-end at exact hit or when no pairs remain. Otherwise player decides.
  const status: GameStatus = reachedTarget || outOfMoves ? 'ended' : 'playing';
  const stars: Stars = status === 'ended' ? starsForDistance(dist) : 0;

  return {
    ok: true,
    next: { ...state, cards: nextCards, history, status, stars },
  };
}

function failReason(op: Op): string {
  switch (op) {
    case '-':
      return 'Результат має бути додатнім';
    case '/':
      return 'Ділення має бути без остачі';
    default:
      return 'Недопустима операція';
  }
}

/** Freeze the board NOW and lock in whatever star rank the closest card gives. */
export function endGame(state: PuzzleState): PuzzleState {
  if (state.status === 'ended') return state;
  const dist = bestDistance(state.cards, state.puzzle.target);
  return {
    ...state,
    status: 'ended',
    stars: starsForDistance(dist),
  };
}

export function undo(state: PuzzleState): PuzzleState {
  if (state.history.length === 0) return state;
  const last = state.history[state.history.length - 1];
  return {
    ...state,
    cards: last.before,
    history: state.history.slice(0, -1),
    status: 'playing',
    stars: 0,
  };
}

export function reset(state: PuzzleState): PuzzleState {
  return initState(state.puzzle);
}

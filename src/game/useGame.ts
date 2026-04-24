import { useCallback, useMemo, useReducer } from 'react';
import type { Op, Puzzle, PuzzleState, Stars } from './types';
import { doOp, endGame, initState, reset, starsForDistance, undo } from './engine';
import { apply } from './ops';
import { haptic } from '../lib/telegram';

/** What would land on card `otherId` if the user committed the current op.
 *  `null` means the op is invalid (negative, non-integer, zero-divide). */
export type PreviewMap = Map<string, number | null>;

type Selection =
  | { phase: 'idle' }
  | { phase: 'num'; cardId: string }
  | { phase: 'op'; cardId: string; op: Op };

type UIState = {
  puzzle: PuzzleState;
  selection: Selection;
  /** Transient message ("not a whole number") — cleared on next action. */
  toast: string | null;
};

type Action =
  | { type: 'pick-card'; cardId: string }
  | { type: 'pick-op'; op: Op }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'finish' }
  | { type: 'load'; puzzle: Puzzle }
  | { type: 'restore'; state: PuzzleState }
  | { type: 'clear-toast' };

function initialize(puzzle: Puzzle): UIState {
  return { puzzle: initState(puzzle), selection: { phase: 'idle' }, toast: null };
}

function reducer(state: UIState, action: Action): UIState {
  switch (action.type) {
    case 'load':
      return initialize(action.puzzle);

    case 'restore':
      return { puzzle: action.state, selection: { phase: 'idle' }, toast: null };

    case 'reset':
      return { ...state, puzzle: reset(state.puzzle), selection: { phase: 'idle' }, toast: null };

    case 'undo':
      return { ...state, puzzle: undo(state.puzzle), selection: { phase: 'idle' }, toast: null };

    case 'finish':
      return {
        ...state,
        puzzle: endGame(state.puzzle),
        selection: { phase: 'idle' },
        toast: null,
      };

    case 'clear-toast':
      return state.toast === null ? state : { ...state, toast: null };

    case 'pick-card': {
      if (state.puzzle.status !== 'playing') return state;
      const card = state.puzzle.cards.find((c) => c.id === action.cardId);
      if (!card || card.used) return state;
      const sel = state.selection;

      if (sel.phase === 'idle') {
        return { ...state, selection: { phase: 'num', cardId: action.cardId }, toast: null };
      }
      if (sel.phase === 'num') {
        if (sel.cardId === action.cardId) {
          return { ...state, selection: { phase: 'idle' } };
        }
        return { ...state, selection: { phase: 'num', cardId: action.cardId } };
      }
      // op phase: execute if different card, deselect if same
      if (sel.cardId === action.cardId) {
        return { ...state, selection: { phase: 'num', cardId: sel.cardId } };
      }
      const res = doOp(state.puzzle, sel.cardId, action.cardId, sel.op);
      if (!res.ok) {
        return { ...state, toast: res.reason, selection: { phase: 'idle' } };
      }
      return { ...state, puzzle: res.next, selection: { phase: 'idle' }, toast: null };
    }

    case 'pick-op': {
      if (state.puzzle.status !== 'playing') return state;
      const sel = state.selection;
      if (sel.phase === 'idle') return state; // need a number first
      if (sel.phase === 'op' && sel.op === action.op) {
        return { ...state, selection: { phase: 'num', cardId: sel.cardId } };
      }
      const cardId = sel.phase === 'num' ? sel.cardId : sel.cardId;
      return { ...state, selection: { phase: 'op', cardId, op: action.op } };
    }
  }
}

export function useGame(puzzle: Puzzle) {
  const [state, dispatch] = useReducer(reducer, puzzle, initialize);

  const pickCard = useCallback((id: string) => {
    haptic.pick();
    dispatch({ type: 'pick-card', cardId: id });
  }, []);
  const pickOp = useCallback((op: Op) => {
    haptic.pick();
    dispatch({ type: 'pick-op', op });
  }, []);
  const doUndo = useCallback(() => {
    haptic.tap();
    dispatch({ type: 'undo' });
  }, []);
  const doReset = useCallback(() => {
    haptic.tap();
    dispatch({ type: 'reset' });
  }, []);
  const doFinish = useCallback(() => {
    haptic.heavy();
    dispatch({ type: 'finish' });
  }, []);
  const loadPuzzle = useCallback((p: Puzzle) => {
    dispatch({ type: 'load', puzzle: p });
  }, []);
  const restoreState = useCallback((s: PuzzleState) => {
    dispatch({ type: 'restore', state: s });
  }, []);
  const clearToast = useCallback(() => {
    dispatch({ type: 'clear-toast' });
  }, []);

  const selectedCardId = state.selection.phase !== 'idle' ? state.selection.cardId : null;
  const selectedOp = state.selection.phase === 'op' ? state.selection.op : null;

  /** Pre-compute what `selected op other` yields for every other active card —
   *  used to draw "=N" / "✕" hints on the board while the op is picked. */
  const previewResults = useMemo<PreviewMap>(() => {
    const out: PreviewMap = new Map();
    const sel = state.selection;
    if (sel.phase !== 'op') return out;
    const left = state.puzzle.cards.find((c) => c.id === sel.cardId);
    if (!left || left.used) return out;
    for (const c of state.puzzle.cards) {
      if (c.used || c.id === left.id) continue;
      out.set(c.id, apply(left.value, c.value, sel.op));
    }
    return out;
  }, [state.selection, state.puzzle.cards]);

  const closestValue = useMemo(() => {
    let best: number | null = null;
    let bestDist = Infinity;
    for (const c of state.puzzle.cards) {
      if (c.used) continue;
      const d = Math.abs(c.value - state.puzzle.puzzle.target);
      if (d < bestDist) {
        bestDist = d;
        best = c.value;
      }
    }
    return { value: best, dist: bestDist };
  }, [state.puzzle]);

  /** Rank the player would get if they stopped right now. */
  const liveStars: Stars = useMemo(
    () => (closestValue.dist === Infinity ? 0 : starsForDistance(closestValue.dist)),
    [closestValue.dist],
  );

  return {
    state,
    selectedCardId,
    selectedOp,
    previewResults,
    closestValue,
    liveStars,
    target: state.puzzle.puzzle.target,
    actions: {
      pickCard,
      pickOp,
      undo: doUndo,
      reset: doReset,
      finish: doFinish,
      load: loadPuzzle,
      restore: restoreState,
      clearToast,
    },
  };
}

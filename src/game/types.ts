export type Op = '+' | '-' | '*' | '/';

export type NumberCard = {
  /** Stable identity — survives moves for animation tracking. */
  id: string;
  value: number;
  /** Monotonic index — used to keep display order stable. */
  bornAt: number;
  /** True once the card has been consumed by an operation. Stays in the
   *  board as a faded tile for visual continuity. */
  used: boolean;
};

export type Step = {
  leftId: string;
  rightId: string;
  op: Op;
  resultId: string;
  resultValue: number;
  /** Snapshot of active cards BEFORE this op, used by undo. */
  before: NumberCard[];
};

export type GameStatus = 'playing' | 'ended';

export type Stars = 0 | 1 | 2 | 3;

export type SolutionStep = {
  a: number;
  b: number;
  op: Op;
  result: number;
};

export type Puzzle = {
  id: string;
  numbers: number[];
  target: number;
  /** Shortest known solution length — drives star grading. */
  minSteps: number;
  /** A handful of sample solutions for hints. */
  solutionsSample: SolutionStep[][];
};

export type PuzzleState = {
  puzzle: Puzzle;
  /** Active cards, in display order (oldest first). */
  cards: NumberCard[];
  history: Step[];
  status: GameStatus;
  stars: Stars;
};

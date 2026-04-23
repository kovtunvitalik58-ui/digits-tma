import type { Op } from './types';

export const OPS: readonly Op[] = ['+', '-', '*', '/'] as const;

export const OP_LABEL: Record<Op, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

/**
 * Returns the result of `a op b`, or null if the operation is not allowed
 * under Digits rules: result must be a positive integer, division must be clean.
 */
export function apply(a: number, b: number, op: Op): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-': {
      const r = a - b;
      return r > 0 ? r : null;
    }
    case '*':
      return a * b;
    case '/':
      if (b === 0) return null;
      return a % b === 0 ? a / b : null;
  }
}

export function isCommutative(op: Op): boolean {
  return op === '+' || op === '*';
}

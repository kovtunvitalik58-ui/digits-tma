import { motion } from 'motion/react';
import type { Op } from '../game/types';
import { OP_LABEL } from '../game/ops';

type Props = {
  op: Op;
  selected: boolean;
  enabled: boolean;
  onPick: (op: Op) => void;
};

export function OpButton({ op, selected, enabled, onPick }: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      animate={{
        scale: selected ? 1.1 : 1,
        opacity: enabled ? 1 : 0.35,
      }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      onClick={() => enabled && onPick(op)}
      disabled={!enabled}
      className={
        'h-14 w-14 rounded-2xl flex items-center justify-center text-3xl font-semibold ' +
        (selected
          ? 'bg-white text-slate-900 shadow-pop'
          : 'bg-surface text-text shadow-card')
      }
      aria-pressed={selected}
      aria-label={`Operation ${op}`}
    >
      {OP_LABEL[op]}
    </motion.button>
  );
}

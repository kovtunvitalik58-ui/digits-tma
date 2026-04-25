import { motion } from 'motion/react';
import type { Op } from '../game/types';
import { OP_LABEL } from '../game/ops';

type Props = {
  op: Op;
  selected: boolean;
  enabled: boolean;
  /** Amber outline + glow when this op is the suggested next move from a
   *  hint. Layered on top of `selected` styling — if the player picks the
   *  hinted op, accent overrides hint visuals. */
  hinted?: boolean;
  onPick: (op: Op) => void;
};

export function OpButton({ op, selected, enabled, hinted, onPick }: Props) {
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
        'relative h-14 w-14 rounded-2xl flex items-center justify-center text-3xl font-semibold overflow-hidden ' +
        (selected
          ? 'bg-accent-fill text-white glow-accent border border-white/30'
          : hinted
            ? 'glass glass-raise text-amber-200 ring-2 ring-amber-300/80 glow-amber'
            : 'glass glass-raise text-text')
      }
      aria-pressed={selected}
      aria-label={`Operation ${op}`}
    >
      {!selected && !hinted && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none"
        />
      )}
      <span className="relative z-10">{OP_LABEL[op]}</span>
    </motion.button>
  );
}

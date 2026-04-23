import { AnimatePresence, motion } from 'motion/react';
import type { NumberCard } from '../game/types';

type Props = {
  card: NumberCard;
  selected: boolean;
  /** Game over — whole board is frozen. */
  frozen: boolean;
  /** Live-preview result if the player commits the pending op on this card.
   *  `undefined` = no preview active; `null` = preview would be invalid;
   *  `number` = valid result. */
  preview?: number | null;
  /** True if the preview hits the puzzle target — this card would win. */
  winning?: boolean;
  onPick: (id: string) => void;
};

export function NumberCardView({ card, selected, frozen, preview, winning, onPick }: Props) {
  const used = card.used;
  const clickable = !used && !frozen;
  const previewActive = preview !== undefined;
  const invalid = previewActive && preview === null;

  return (
    <motion.button
      layout
      layoutId={`card-${card.id}`}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{
        // Scale down for used cards. Selected cards don't grow — they lift
        // slightly via y so the bottom row never clips into the ops bar.
        scale: used ? 0.88 : 1,
        y: selected ? -3 : 0,
        opacity: used ? 0.28 : invalid ? 0.55 : frozen ? 0.5 : 1,
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 28, mass: 0.7 }}
      whileTap={clickable ? { scale: 0.95 } : undefined}
      onClick={() => clickable && onPick(card.id)}
      disabled={!clickable}
      aria-disabled={!clickable}
      className={
        'relative w-full h-full rounded-2xl flex items-center justify-center ' +
        'text-[clamp(1rem,6cqmin,1.75rem)] font-semibold tabular-nums select-none transition-colors ' +
        (selected
          ? 'bg-accent text-white shadow-pop ring-2 ring-white/40 brightness-110'
          : used
            ? 'bg-surface/40 text-hint shadow-none ring-1 ring-white/5'
            : winning
              ? 'bg-surface text-text shadow-pop ring-2 ring-amber-400'
              : 'bg-surface text-text shadow-card active:brightness-110')
      }
      aria-pressed={selected}
      aria-label={
        `Число ${card.value}` +
        (used ? ' (використане)' : '') +
        (previewActive && preview !== null ? ` → ${preview}` : '')
      }
      data-card-id={card.id}
      data-used={used ? 'true' : 'false'}
    >
      <span className={used ? 'line-through decoration-hint/60 decoration-[2px]' : ''}>
        {card.value}
      </span>

      <AnimatePresence>
        {previewActive && !selected && !used && (
          <motion.span
            key={`${preview}`}
            initial={{ scale: 0.5, opacity: 0, y: 4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className={
              'absolute -top-1.5 -right-1.5 min-w-[28px] h-6 px-1.5 rounded-full ' +
              'flex items-center justify-center text-[11px] font-semibold tabular-nums ' +
              'ring-2 ring-bg ' +
              (invalid
                ? 'bg-surface text-hint/80'
                : winning
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-accent text-white')
            }
            aria-hidden
          >
            {invalid ? '✕' : `=${preview}`}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

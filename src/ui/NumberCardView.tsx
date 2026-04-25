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
  /** True when this card is one of the two operands of an active hint.
   *  Same amber treatment as `winning`, applied in the absence of a live
   *  preview. */
  hinted?: boolean;
  onPick: (id: string) => void;
};

export function NumberCardView({ card, selected, frozen, preview, winning, hinted, onPick }: Props) {
  const used = card.used;
  const clickable = !used && !frozen;
  const previewActive = preview !== undefined;
  const invalid = previewActive && preview === null;

  const base =
    'relative w-full h-full rounded-3xl flex items-center justify-center ' +
    'text-[clamp(1rem,6cqmin,1.75rem)] font-semibold tabular-nums select-none ' +
    'transition-colors';

  const stateClass = selected
    ? 'text-white glow-accent border border-white/25 bg-accent-fill'
    : used
      ? 'glass text-hint'
      : winning
        ? 'glass-strong glass-raise text-text ring-2 ring-amber-300/80 glow-amber'
        : hinted
          ? 'glass-strong glass-raise text-text ring-2 ring-amber-300/80 glow-amber'
          : 'glass glass-raise text-text';

  return (
    <motion.button
      layout
      layoutId={`card-${card.id}`}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{
        scale: used ? 0.88 : 1,
        y: selected ? -3 : 0,
        opacity: used ? 0.35 : invalid ? 0.55 : frozen ? 0.55 : 1,
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 28, mass: 0.7 }}
      whileTap={clickable ? { scale: 0.95 } : undefined}
      onClick={() => clickable && onPick(card.id)}
      disabled={!clickable}
      aria-disabled={!clickable}
      className={base + ' ' + stateClass}
      aria-pressed={selected}
      aria-label={
        `Число ${card.value}` +
        (used ? ' (використане)' : '') +
        (previewActive && preview !== null ? ` → ${preview}` : '')
      }
      data-card-id={card.id}
      data-used={used ? 'true' : 'false'}
    >
      {/* Top-gloss reflection — tiny white sheen on the upper third. */}
      {!used && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1/2 rounded-t-3xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none"
        />
      )}

      <span
        className={
          'relative z-10 ' +
          (used ? 'line-through decoration-hint/50 decoration-[2px]' : '')
        }
      >
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
              'ring-2 ring-[color:var(--tg-bg)] z-20 ' +
              (invalid
                ? 'bg-white/10 text-hint/80 backdrop-blur'
                : winning
                  ? 'bg-amber-300 text-slate-900 shadow-[0_4px_14px_rgba(251,191,36,0.55)]'
                  : 'bg-accent-fill text-white shadow-[0_4px_12px_rgba(20,184,166,0.35)]')
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

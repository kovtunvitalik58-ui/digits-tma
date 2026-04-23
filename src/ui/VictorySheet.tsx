import { AnimatePresence, motion } from 'motion/react';
import type { Stars } from '../game/types';

type Props = {
  open: boolean;
  stars: Stars;
  /** Distance of closest card to target at game end. */
  distance: number;
  target: number;
  closest: number | null;
  opsUsed: number;
  onShare: () => void;
  onClose: () => void;
};

export function VictorySheet({
  open,
  stars,
  distance,
  target,
  closest,
  opsUsed,
  onShare,
  onClose,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl p-6 pt-4 safe-bottom"
          >
            <div className="mx-auto mb-4 w-12 h-1.5 rounded-full bg-hint/40" />
            <h2 className="text-2xl font-bold text-center">{title(stars)}</h2>
            <div className="mt-4 flex justify-center gap-2">
              {[1, 2, 3].map((i) => (
                <Star key={i} filled={i <= stars} index={i} />
              ))}
            </div>
            <div className="mt-3 text-center text-hint text-sm">
              {closest !== null ? (
                distance === 0 ? (
                  <span className="text-success font-medium">{closest} = {target}</span>
                ) : (
                  <>
                    <span className="text-text font-medium tabular-nums">{closest}</span>
                    <span className="opacity-60"> {distance > 0 ? `за ${distance} від ${target}` : ''}</span>
                  </>
                )
              ) : (
                <span>Немає активних карток</span>
              )}
              <span className="opacity-40"> · {opsUsed} ход{ruPlural(opsUsed, '', 'и', 'ів')}</span>
            </div>
            <div className="mt-6 grid grid-cols-[1fr_auto] gap-2">
              <button
                onClick={onShare}
                className="h-12 rounded-2xl bg-accent text-white font-semibold text-base shadow-pop active:brightness-110 flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                Поділитись
              </button>
              <button
                onClick={onClose}
                aria-label="Закрити"
                className="h-12 px-4 rounded-2xl bg-surface/60 text-text font-medium text-sm active:brightness-110"
              >
                Закрити
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function title(stars: Stars): string {
  switch (stars) {
    case 3:
      return 'Ідеально!';
    case 2:
      return 'Майже в ціль';
    case 1:
      return 'Непогано';
    default:
      return 'Спробуй ще раз';
  }
}

function Star({ filled, index }: { filled: boolean; index: number }) {
  return (
    <motion.svg
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.1 + index * 0.08 }}
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill={filled ? '#fbbf24' : 'none'}
      stroke={filled ? '#fbbf24' : '#475569'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </motion.svg>
  );
}

function ruPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

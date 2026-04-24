import { motion } from 'motion/react';
import type { Stars } from '../game/types';

type Props = {
  target: number;
  liveStars: Stars;
};

export function Header({ target, liveStars }: Props) {
  return (
    <header className="flex flex-col items-center pt-4 pb-6">
      <div className="text-hint text-[11px] uppercase tracking-[0.28em] mb-1.5">Ціль</div>
      <motion.div
        key={target}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="relative text-[64px] leading-none font-bold tabular-nums tracking-tight
                   bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent
                   drop-shadow-[0_4px_16px_rgba(20,184,166,0.18)]"
      >
        {target}
      </motion.div>
      <StarRow value={liveStars} />
    </header>
  );
}

function StarRow({ value }: { value: Stars }) {
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-label={`Зараз ${value} із 3 зірок`}>
      {[1, 2, 3].map((i) => {
        const filled = i <= value;
        return (
          <motion.svg
            key={i}
            animate={{ scale: filled ? 1 : 0.9, opacity: filled ? 1 : 0.35 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={filled ? '#fbbf24' : 'none'}
            stroke={filled ? '#fbbf24' : '#475569'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={
              filled
                ? { filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.6))' }
                : undefined
            }
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </motion.svg>
        );
      })}
    </div>
  );
}

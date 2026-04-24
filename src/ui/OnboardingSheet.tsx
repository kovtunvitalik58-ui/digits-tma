import { AnimatePresence, motion } from 'motion/react';

type Props = {
  open: boolean;
  target: number;
  onClose: () => void;
};

export function OnboardingSheet({ open, target, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl p-6 pt-4 safe-bottom max-h-[90dvh] overflow-y-auto"
          >
            <div className="mx-auto mb-4 w-12 h-1.5 rounded-full bg-hint/40" />
            <h2 className="text-2xl font-bold text-center">Як грати</h2>
            <p className="mt-2 text-center text-hint text-sm leading-relaxed">
              Склади з 6 чисел результат, який дорівнює цілі —{' '}
              <span className="text-text font-semibold tabular-nums">{target}</span>.
            </p>

            <ol className="mt-6 flex flex-col gap-4">
              <Step
                n={1}
                title="Обирай два числа"
                body="Натисни на картку, потім на дію (+, −, ×, ÷), потім на другу картку."
              />
              <Step
                n={2}
                title="Наближайся до цілі"
                body="Результат стає новою карткою. Використовуй її в наступних ходах."
              />
              <Step
                n={3}
                title="Цілься на 3 зірки"
                body={
                  <>
                    <StarInline filled /> точно в ціль &nbsp;·&nbsp;{' '}
                    <StarInline filled /> за 10 &nbsp;·&nbsp; <StarInline filled /> за 20
                  </>
                }
              />
            </ol>

            <p className="mt-6 text-center text-xs text-hint leading-relaxed">
              Одна нова головоломка щодня. Можна відмінити хід — але не більше 3 разів на
              день.
            </p>

            <button
              onClick={onClose}
              className="mt-6 w-full h-12 rounded-2xl bg-accent text-white font-semibold text-base shadow-pop active:brightness-110"
            >
              Грати
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold tabular-nums">
        {n}
      </div>
      <div className="flex-1 pt-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-hint leading-relaxed mt-0.5">{body}</p>
      </div>
    </li>
  );
}

function StarInline({ filled }: { filled: boolean }) {
  return (
    <svg
      className="inline-block align-[-2px]"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill={filled ? '#fbbf24' : 'none'}
      stroke={filled ? '#fbbf24' : '#475569'}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

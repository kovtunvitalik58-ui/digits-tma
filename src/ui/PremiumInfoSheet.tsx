import { AnimatePresence, motion } from 'motion/react';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PremiumInfoSheet({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 glass-strong glass-raise rounded-t-[32px] p-6 pt-4 safe-bottom"
          >
            <div className="mx-auto mb-4 w-12 h-1.5 rounded-full bg-white/25" />
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-[0.28em] text-hint">
                Незабаром
              </span>
            </div>
            <h2 className="text-2xl font-bold text-center bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Бонус активним
            </h2>
            <p className="mt-3 text-center text-sm text-hint leading-relaxed">
              Збери <span className="text-text font-semibold">100 ⭐</span> за
              місяць — і отримай обидва бонуси на наступний:
            </p>

            <div className="mt-5 flex flex-col gap-2.5">
              <FeatureRow
                title="Підказка дня"
                body="Один раз на добу гра підкаже наступний крок, коли застряг."
                icon={<LightbulbIcon />}
              />
              <FeatureRow
                title="Тренувальні задачі"
                body="Грай скільки хочеш — результати не впливають на стрик і лідерборд."
                icon={<TargetIcon />}
              />
            </div>

            <button
              onClick={onClose}
              className="relative overflow-hidden mt-6 w-full h-12 rounded-2xl bg-accent-fill text-white font-semibold text-base glow-accent border border-white/25 active:brightness-110"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/15 to-transparent pointer-events-none"
              />
              <span className="relative z-10">Зрозуміло</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function FeatureRow({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-2xl glass">
      <div className="shrink-0 w-9 h-9 rounded-xl bg-[color:var(--tg-accent-soft)] flex items-center justify-center text-accent">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text">{title}</div>
        <div className="mt-0.5 text-xs text-hint leading-relaxed">{body}</div>
      </div>
    </div>
  );
}

function LightbulbIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5C17.7 10.2 18 9.5 18 8a6 6 0 0 0-12 0c0 1.5.5 2.2 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

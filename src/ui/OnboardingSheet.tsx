import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  target: number;
  onClose: () => void;
};

export function OnboardingSheet({ open, target, onClose }: Props) {
  const [step, setStep] = useState(0);
  const steps = buildSteps(target);
  const last = step === steps.length - 1;

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm glass-strong glass-raise rounded-[28px] shadow-pop overflow-hidden flex flex-col"
          >
            <div className="relative h-56 bg-[color:var(--tg-accent-soft)]/60 flex items-center justify-center overflow-hidden border-b border-white/5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.28 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {steps[step].demo}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="px-6 pt-5 pb-4 min-h-[112px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 className="text-xl font-bold text-center bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">{steps[step].title}</h2>
                  <p className="mt-2 text-center text-sm text-hint leading-relaxed">
                    {steps[step].body}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="px-6 pb-5 safe-bottom">
              <div className="flex justify-center gap-1.5 mb-4">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    aria-label={`Крок ${i + 1}`}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === step ? 20 : 6,
                      backgroundColor: i === step ? 'var(--tg-accent)' : 'var(--tg-hint)',
                      opacity: i === step ? 1 : 0.4,
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="h-12 px-5 rounded-2xl glass text-text font-medium text-sm active:brightness-110"
                  >
                    Назад
                  </button>
                )}
                <button
                  onClick={() => (last ? onClose() : setStep(step + 1))}
                  className="relative overflow-hidden flex-1 h-12 rounded-2xl bg-accent-fill text-white font-semibold text-base glow-accent border border-white/25 active:brightness-110"
                >
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                  <span className="relative z-10">{last ? 'Грати' : 'Далі'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type Step = {
  title: string;
  body: React.ReactNode;
  demo: React.ReactNode;
};

function buildSteps(target: number): Step[] {
  return [
    {
      title: 'Дійди до цілі',
      body: (
        <>
          Комбінуй шість чисел діями, поки не отримаєш ціль —{' '}
          <span className="text-text font-semibold tabular-nums">{target}</span>.
        </>
      ),
      demo: <IntroDemo target={target} />,
    },
    {
      title: 'Поєднуй по дві',
      body: 'Обери картку, дію (+, −, ×, ÷) та ще одну картку — і вони зіллються в одну.',
      demo: <OpDemo />,
    },
    {
      title: 'Результат — нова картка',
      body: 'Стара пара зникає з поля. Продовжуй комбінувати, поки не лишиться одне число.',
      demo: <ChainDemo />,
    },
    {
      title: 'Ближче до цілі — більше зірок',
      body: '3★ — точно в ціль, 2★ — у межах 10, 1★ — у межах 20.',
      demo: <StarsDemo target={target} />,
    },
  ];
}

function IntroDemo({ target }: { target: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-hint">Ціль</div>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        className="text-5xl font-bold tabular-nums"
      >
        {target}
      </motion.div>
      <div className="flex gap-1.5 mt-1">
        {[0, 1, 2].map((i) => (
          <motion.svg
            key={i}
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 20,
              delay: 0.3 + i * 0.08,
            }}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="#fbbf24"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </motion.svg>
        ))}
      </div>
    </div>
  );
}

function OpDemo() {
  // Loop: 9 highlights → + highlights → 5 highlights → "14" result fades in → pause → restart.
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const delays = [650, 550, 550, 900, 700];
    const t = setTimeout(() => setPhase((p) => (p + 1) % 5), delays[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  const showResult = phase === 3;
  return (
    <div className="flex items-center gap-2">
      <DemoCard value={9} active={phase === 0} />
      <DemoOp symbol="+" active={phase === 1} />
      <DemoCard value={5} active={phase === 2} />
      <motion.div
        animate={{ opacity: showResult || phase === 4 ? 1 : 0, x: showResult ? 0 : -8 }}
        transition={{ duration: 0.35 }}
        className="flex items-center gap-2"
      >
        <span className="text-hint text-lg font-medium">=</span>
        <DemoCard value={14} active={showResult} tone="result" />
      </motion.div>
    </div>
  );
}

function ChainDemo() {
  // Frame A: cards [14, 6]. Frame B: merging. Frame C: card [84] remains, labeled "×".
  const [phase, setPhase] = useState<'a' | 'b' | 'c'>('a');
  useEffect(() => {
    const seq: Array<['a' | 'b' | 'c', number]> = [
      ['a', 900],
      ['b', 700],
      ['c', 1200],
    ];
    const current = seq.find(([p]) => p === phase)!;
    const t = setTimeout(() => {
      setPhase(phase === 'a' ? 'b' : phase === 'b' ? 'c' : 'a');
    }, current[1]);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="relative flex items-center justify-center gap-3 h-20">
      <motion.div
        animate={{
          x: phase === 'a' ? -30 : 0,
          opacity: phase === 'c' ? 0 : 1,
          scale: phase === 'c' ? 0.8 : 1,
        }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      >
        <DemoCard value={14} />
      </motion.div>
      <motion.div
        animate={{ opacity: phase === 'a' ? 1 : 0, scale: phase === 'a' ? 1 : 0.6 }}
        transition={{ duration: 0.3 }}
        className="text-hint text-lg font-medium absolute left-1/2 -translate-x-1/2"
      >
        ×
      </motion.div>
      <motion.div
        animate={{
          x: phase === 'a' ? 30 : 0,
          opacity: phase === 'c' ? 0 : 1,
          scale: phase === 'c' ? 0.8 : 1,
        }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      >
        <DemoCard value={6} />
      </motion.div>
      <motion.div
        animate={{
          opacity: phase === 'c' ? 1 : 0,
          scale: phase === 'c' ? 1 : 0.6,
        }}
        transition={{ type: 'spring', stiffness: 280, damping: 20 }}
        className="absolute"
      >
        <DemoCard value={84} tone="result" />
      </motion.div>
    </div>
  );
}

function StarsDemo({ target }: { target: number }) {
  // Show three scenarios animating in sequence — anchored to the player's
  // actual target so the example numbers match the step-1 card.
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p + 1) % 4), 900);
    return () => clearTimeout(t);
  }, [phase]);

  const rows = [
    { label: `${target}`, diff: `= ${target}`, stars: 3 as const },
    { label: `${target - 5}`, diff: '±5', stars: 2 as const },
    { label: `${target - 12}`, diff: '±12', stars: 1 as const },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -16 }}
          animate={{
            opacity: phase > i ? 1 : 0,
            x: phase > i ? 0 : -16,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="flex items-center gap-3 px-3 py-1.5 rounded-xl glass"
        >
          <span className="w-10 text-right tabular-nums font-semibold">{r.label}</span>
          <span className="text-[11px] text-hint w-10">{r.diff}</span>
          <span className="flex gap-0.5 ml-1">
            {[1, 2, 3].map((k) => (
              <svg
                key={k}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill={k <= r.stars ? '#fbbf24' : 'none'}
                stroke={k <= r.stars ? '#fbbf24' : '#475569'}
                strokeWidth="2.2"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ))}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function DemoCard({
  value,
  active,
  tone,
}: {
  value: number;
  active?: boolean;
  tone?: 'result';
}) {
  const bg =
    tone === 'result'
      ? 'bg-[color:var(--tg-accent-soft)] border border-accent/60 glow-accent text-white'
      : active
        ? 'bg-accent-fill border border-white/25 glow-accent text-white'
        : 'glass glass-raise text-text';
  return (
    <motion.div
      animate={{ scale: active ? 1.08 : 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-semibold tabular-nums ${bg}`}
    >
      {value}
    </motion.div>
  );
}

function DemoOp({ symbol, active }: { symbol: string; active: boolean }) {
  return (
    <motion.div
      animate={{ scale: active ? 1.15 : 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      className={
        'w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold ' +
        (active
          ? 'bg-accent-fill text-white border border-white/25 glow-accent'
          : 'glass text-hint')
      }
    >
      {symbol}
    </motion.div>
  );
}

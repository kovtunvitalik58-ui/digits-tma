import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';

type Props = {
  message: string | null;
  onDone: () => void;
  duration?: number;
};

export function Toast({ message, onDone, duration = 1400 }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [message, onDone, duration]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-24 z-40 glass glass-raise text-text text-sm px-4 py-2 rounded-full"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

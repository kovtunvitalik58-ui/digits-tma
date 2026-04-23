import { useCallback, useEffect, useState } from 'react';
import { UNDO_DAILY_LIMIT, consumeUndo, loadUndosRemaining } from './undoLimit';

export function useUndoLimit() {
  // Optimistically start at the full quota so the button doesn't flash disabled
  // on first paint; the real value is swapped in once storage resolves.
  const [remaining, setRemaining] = useState<number>(UNDO_DAILY_LIMIT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadUndosRemaining().then((r) => {
      if (cancelled) return;
      setRemaining(r);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Spend one undo. Returns true if the caller may proceed with the action. */
  const consume = useCallback(async (): Promise<boolean> => {
    const res = await consumeUndo();
    setRemaining(res.remaining);
    return res.ok;
  }, []);

  return { remaining, loaded, consume, limit: UNDO_DAILY_LIMIT };
}

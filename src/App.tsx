import { useEffect, useMemo, useState } from 'react';
import { useGame } from './game/useGame';
import { todayPuzzle } from './game/generator';
import { nextHint, type Hint } from './game/hint';
import { puzzleSignature, trainingPuzzle } from './game/training';
import { Header } from './ui/Header';
import { GameBoard } from './ui/GameBoard';
import { Toolbar } from './ui/Toolbar';
import { Toast } from './ui/Toast';
import { VictorySheet } from './ui/VictorySheet';
import { LeaderboardSheet } from './ui/LeaderboardSheet';
import { OnboardingSheet } from './ui/OnboardingSheet';
import { PremiumInfoSheet } from './ui/PremiumInfoSheet';
import { getStartParam, getUserId, haptic, shareResult, storage } from './lib/telegram';
import { loadStats, recordDailySolve, saveStats, type Stats } from './game/stats';
import { buildShareText } from './game/share';
import { buildReferralUrl, parseRefFromStartParam } from './game/friends';
import {
  loadDailyResult,
  loadDailyResultSync,
  saveDailyResult,
  type DailyResult,
} from './game/dailyResult';
import { kyivIsoDate } from './lib/kyivDate';
import { pushResult, registerUser } from './lib/api';

export default function App() {
  // Manual reset hatch — wipes storage and reloads as a first-time player.
  if (typeof window !== 'undefined' && isResetRequested()) {
    void resetAllState();
    return null;
  }
  return (
    <AutoWipeGate>
      <GameApp />
    </AutoWipeGate>
  );
}

// One-shot auto-wipe scoped to WIPE_GEN. The flag lives in CloudStorage
// (not localStorage) so iOS Telegram WebView eviction can't retrigger the
// wipe on every reopen. Bump `WIPE_GEN` to push a clean state to everyone.
const WIPE_GEN = 'v2';
const WIPE_FLAG_KEY = 'wipeGen';

function AutoWipeGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await storage.get(WIPE_FLAG_KEY);
        if (cancelled) return;
        if (seen === WIPE_GEN) {
          setReady(true);
          return;
        }
        await storage.clearAll();
        await storage.set(WIPE_FLAG_KEY, WIPE_GEN);
        window.location.reload();
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (!ready) return null;
  return <>{children}</>;
}

function GameApp() {

  const initialPuzzle = useMemo(() => todayPuzzle(), []);
  // Read the saved result synchronously so the first paint already shows the
  // finished board and the VictorySheet — no flash of a fresh puzzle while
  // the async CloudStorage read resolves. `saveDailyResult` mirrors into
  // localStorage, so the local copy is authoritative on this device.
  // If the saved result was produced against a different target (e.g. the
  // generator formula changed mid-day), ignore it so the player doesn't end
  // up with a stale board under a new target.
  const initialDaily = useMemo(() => {
    const r = loadDailyResultSync(kyivIsoDate());
    if (!r || r.target !== initialPuzzle.target) return null;
    return r;
  }, [initialPuzzle.target]);
  const game = useGame(initialPuzzle, initialDaily?.finalState);
  const [stats, setStats] = useState<Stats | null>(null);
  const [victoryOpen, setVictoryOpen] = useState(!!initialDaily);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => !readOnboardedFlagSync(),
  );
  const [premiumInfoOpen, setPremiumInfoOpen] = useState(false);
  const [recordedFor, setRecordedFor] = useState<string | null>(null);
  const [todayResult, setTodayResult] = useState<DailyResult | null>(initialDaily);
  // Training mode lives entirely client-side: a different puzzle is loaded
  // into the existing game machine, no result hits CloudStorage or the
  // server, no streak movement. `trainingCount` is persisted to storage so
  // it never reuses a seed across sessions; `trainingSeen` carries the
  // last-N {numbers, target} signatures so the generator can dodge repeats
  // even when independent seeds would otherwise collide.
  const [mode, setMode] = useState<'daily' | 'training'>('daily');
  const [trainingCount, setTrainingCount] = useState(0);
  const [trainingSeen, setTrainingSeen] = useState<string[]>([]);
  // Active hint: glow on the two suggested operand cards + the operation
  // button. Stays put until the player either makes any move (auto-cleared
  // by an effect on history length) or taps "Підказка" again from a fresh
  // board state.
  const [hint, setHint] = useState<Hint | null>(null);

  // Load persisted stats once.
  useEffect(() => {
    loadStats().then(setStats);
  }, []);

  // Hydrate the training counter + seen-set from storage so a player who
  // closes and reopens the app continues with fresh, non-repeating tasks
  // instead of restarting from train-<userId>-1.
  useEffect(() => {
    storage
      .getJSON<{ count?: number; seen?: string[] }>(TRAINING_KEY)
      .then((d) => {
        if (!d) return;
        if (typeof d.count === 'number' && d.count > 0) setTrainingCount(d.count);
        if (Array.isArray(d.seen)) setTrainingSeen(d.seen);
      });
  }, []);

  // Cross-device sync: if CloudStorage holds a newer result than the
  // localStorage sync read gave us, swap it in. `layoutId` on the number
  // cards animates the transition so a late restore looks intentional
  // rather than like a glitch.
  useEffect(() => {
    loadDailyResult(kyivIsoDate()).then((r) => {
      if (!r) return;
      if (r.target !== initialPuzzle.target) return;
      if (initialDaily && r.finishedAt <= initialDaily.finishedAt) return;
      setTodayResult(r);
      if (r.finalState) game.actions.restore(r.finalState);
      setVictoryOpen(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tell the backend who's playing so it can notify friends and run the
  // daily push. Carries the referrer too in case the player landed via a
  // direct-link mini-app URL — the canonical path is the bot webhook on
  // /start ref_<id>, but this stays as a fallback.
  useEffect(() => {
    const referrer = parseRefFromStartParam(getStartParam());
    registerUser(referrer);
  }, []);

  const closeOnboarding = () => {
    setOnboardingOpen(false);
    storage.set(ONBOARDED_KEY, '1').catch(() => void 0);
  };

  // React to game-ending: haptics, show result sheet, persist result, bump streak.
  const { status, puzzle: puzzleState } = game.state.puzzle;
  const puzzleId = puzzleState.id;
  const stars = game.state.puzzle.stars;
  const opsUsed = game.state.puzzle.history.length;
  useEffect(() => {
    if (status !== 'ended') return;
    // Replay path — saved daily restored on mount. No haptics, no save.
    if (mode === 'daily' && todayResult) return;

    if (stars >= 2) haptic.success();
    else if (stars === 1) haptic.warn();
    else haptic.error();
    setVictoryOpen(true);

    // Training tasks are ephemeral — no CloudStorage write, no leaderboard
    // push, no streak update. Bail before any of those side effects fire.
    if (mode === 'training') return;

    // Freeze the result for the rest of the Kyiv day.
    const result: DailyResult = {
      dateId: kyivIsoDate(),
      stars,
      target: puzzleState.target,
      closest: game.closestValue.value,
      distance: game.closestValue.dist === Infinity ? 0 : game.closestValue.dist,
      opsUsed,
      finishedAt: Date.now(),
      finalState: game.state.puzzle,
    };
    saveDailyResult(result).catch(() => void 0);
    pushResult(result);
    setTodayResult(result);

    // Streak increments only on an actual win (≥ 1 star).
    if (stars === 0) return;
    if (recordedFor === puzzleId) return;
    setRecordedFor(puzzleId);
    (async () => {
      const current = await loadStats();
      const next = recordDailySolve(current, stars);
      await saveStats(next);
      setStats(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, puzzleId, stars, recordedFor, todayResult, mode]);

  // Daily board freezes once the saved result lands; training is always
  // live (no persistence) so the only freeze is the natural game-end.
  const playing =
    status === 'playing' && (mode === 'training' || !todayResult);

  // For daily replays, surface the saved values; for any live state
  // (training task, or daily-in-progress), pull from the live game.
  const useSavedDaily = mode === 'daily' && !!todayResult;
  const displayStars = useSavedDaily ? todayResult.stars : stars;
  const displayClosest = useSavedDaily ? todayResult.closest : game.closestValue.value;
  const displayDistance = useSavedDaily
    ? todayResult.distance
    : game.closestValue.dist === Infinity
      ? 0
      : game.closestValue.dist;
  const displayOpsUsed = useSavedDaily ? todayResult.opsUsed : opsUsed;

  const onShare = async () => {
    haptic.tap();
    const url = buildReferralUrl(getUserId());
    // Before the puzzle is finished the "result" is just a 0-star placeholder
    // — share an invite blurb instead so the recipient gets an actual hook.
    const text = todayResult
      ? buildShareText({
          target: puzzleState.target,
          stars: displayStars,
          closest: displayClosest,
          distance: displayDistance,
          opsUsed: displayOpsUsed,
          dateId: puzzleState.id,
        })
      : `Digits — щоденний математичний пазл. Спробуй сьогоднішній:`;
    await shareResult(text, url);
  };

  const openLeaderboard = () => {
    haptic.tap();
    setLeaderboardOpen(true);
  };

  const openOnboarding = () => {
    haptic.tap();
    setOnboardingOpen(true);
  };

  const openPremiumInfo = () => {
    haptic.tap();
    setPremiumInfoOpen(true);
  };

  // Single helper for both "enter from sheet" and "play another after
  // finishing" — increments the persistent counter, generates a puzzle that
  // dodges every recently-seen signature, slides the new signature into
  // the seen list (FIFO-capped at SEEN_CAP), and writes the lot back to
  // storage so the next session continues uninterrupted.
  const startNextTraining = (heavy: boolean): void => {
    if (heavy) haptic.heavy();
    else haptic.tap();
    const next = trainingCount + 1;
    const seen = new Set(trainingSeen);
    const p = trainingPuzzle(getUserId(), next, seen);
    const nextSeen = [...trainingSeen, puzzleSignature(p)].slice(-SEEN_CAP);
    setTrainingCount(next);
    setTrainingSeen(nextSeen);
    storage
      .setJSON(TRAINING_KEY, { count: next, seen: nextSeen })
      .catch(() => void 0);
    setVictoryOpen(false);
    game.actions.load(p);
  };

  const enterTraining = () => {
    setMode('training');
    startNextTraining(true);
  };

  const nextTraining = () => {
    startNextTraining(false);
  };

  // Hint flow: re-solve from the live board on demand and surface the
  // first suggested step. No daily quota during beta — when paid Premium
  // ships, this gate moves to a server-checked subscription state.
  const onHint = () => {
    if (!playing) return;
    haptic.tap();
    const h = nextHint(game.state.puzzle);
    if (!h) {
      game.actions.setToast('Підказки немає — спробуй заново');
      setHint(null);
      return;
    }
    setHint(h);
  };

  // Clear the glow once the player makes any move — the hint maps to a
  // specific board state and goes stale the instant cards rearrange.
  const historyLen = game.state.puzzle.history.length;
  useEffect(() => {
    setHint(null);
  }, [historyLen, puzzleId]);

  // Drop training and put the daily back on screen exactly as it was —
  // restored finished board if there's a saved result, otherwise reload
  // today's puzzle from scratch (player walked into training before
  // finishing daily).
  const exitTraining = () => {
    haptic.tap();
    setMode('daily');
    setVictoryOpen(false);
    if (todayResult?.finalState) {
      game.actions.restore(todayResult.finalState);
    } else {
      game.actions.load(initialPuzzle);
    }
  };

  return (
    <div className="h-dvh overflow-hidden flex flex-col safe-top">
      <TopBar
        streak={stats?.streak ?? 0}
        onOpenLeaderboard={openLeaderboard}
        onOpenHelp={openOnboarding}
        onOpenPremiumInfo={openPremiumInfo}
        onShare={onShare}
      />

      <Header target={puzzleState.target} liveStars={game.liveStars} mode={mode} />

      <GameBoard
        cards={game.state.puzzle.cards}
        selectedCardId={game.selectedCardId}
        selectedOp={game.selectedOp}
        previewResults={game.previewResults}
        target={game.target}
        playing={playing}
        hint={hint}
        onPickCard={game.actions.pickCard}
        onPickOp={game.actions.pickOp}
      />

      <Toolbar
        canUndo={game.state.puzzle.history.length > 0 && playing}
        canFinish={playing && game.liveStars > 0}
        canHint={playing}
        hintActive={hint !== null}
        onUndo={game.actions.undo}
        onFinish={game.actions.finish}
        onHint={onHint}
      />

      <Toast message={game.state.toast} onDone={game.actions.clearToast} />

      <VictorySheet
        open={victoryOpen}
        mode={mode}
        stars={displayStars}
        distance={displayDistance}
        target={puzzleState.target}
        closest={displayClosest}
        opsUsed={displayOpsUsed}
        onShare={onShare}
        onClose={mode === 'training' ? exitTraining : () => setVictoryOpen(false)}
        onPlayAnother={nextTraining}
      />

      <LeaderboardSheet
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        onShare={onShare}
      />

      <OnboardingSheet
        open={onboardingOpen}
        target={puzzleState.target}
        onClose={closeOnboarding}
      />

      <PremiumInfoSheet
        open={premiumInfoOpen}
        onClose={() => setPremiumInfoOpen(false)}
        onTryTraining={enterTraining}
      />
    </div>
  );
}

// Bumped if the instructions change materially, so returning players see the
// updated onboarding once.
const ONBOARDED_KEY = 'onboarded:v6';

// CloudStorage key for the training counter + recently-seen signatures.
// Keeping both under one key means one read on mount and one write per
// task, no chance of the two falling out of sync.
const TRAINING_KEY = 'training';
// Upper bound on the seen-set. ~30 chars per entry × 100 = 3 KB, well under
// CloudStorage's 4 KB-per-key budget. Past this point a player has clearly
// played enough trainings that the oldest one is forgotten anyway.
const SEEN_CAP = 100;

// Must match the LS_PREFIX in src/lib/telegram.ts — `storage.set` mirrors all
// writes there, so reading it directly is a valid synchronous shortcut.
function readOnboardedFlagSync(): string | null {
  try {
    return localStorage.getItem('digits:' + ONBOARDED_KEY);
  } catch {
    return null;
  }
}

function isResetRequested(): boolean {
  if (getStartParam() === 'reset') return true;
  try {
    return new URL(window.location.href).searchParams.get('reset') === '1';
  } catch {
    return false;
  }
}

async function resetAllState(): Promise<void> {
  await storage.clearAll();
  // Drop the trigger params from the URL so a second refresh doesn't wipe
  // again after the player legitimately starts playing.
  const url = new URL(window.location.href);
  url.searchParams.delete('startapp');
  url.searchParams.delete('tgWebAppStartParam');
  url.searchParams.delete('reset');
  window.location.replace(url.toString());
}

function TopBar({
  streak,
  onOpenLeaderboard,
  onOpenHelp,
  onOpenPremiumInfo,
  onShare,
}: {
  streak: number;
  onOpenLeaderboard: () => void;
  onOpenHelp: () => void;
  onOpenPremiumInfo: () => void;
  onShare: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 h-11">
      <div className="flex items-center gap-1 text-sm">
        <span>🔥</span>
        <span className="tabular-nums text-text font-medium">{streak}</span>
      </div>
      <div className="flex items-center">
        <button
          onClick={onOpenHelp}
          aria-label="Як грати"
          className="w-9 h-9 rounded-full flex items-center justify-center text-hint active:text-text active:bg-surface/60"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
        <button
          onClick={onShare}
          aria-label="Поділитись"
          className="w-9 h-9 rounded-full flex items-center justify-center text-hint active:text-text active:bg-surface/60"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
        <button
          onClick={onOpenLeaderboard}
          aria-label="Лідерборд"
          className="w-9 h-9 rounded-full flex items-center justify-center text-hint active:text-text active:bg-surface/60"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
            <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
            <path d="M6 3h12v8a6 6 0 0 1-12 0z" />
            <path d="M10 21h4" />
            <path d="M12 17v4" />
          </svg>
        </button>
        <button
          onClick={onOpenPremiumInfo}
          aria-label="Підказка та тренування"
          className="w-9 h-9 rounded-full flex items-center justify-center text-hint active:text-text active:bg-surface/60"
        >
          <svg
            width="20"
            height="20"
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
        </button>
      </div>
    </div>
  );
}

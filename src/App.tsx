import { useEffect, useMemo, useState } from 'react';
import { useGame } from './game/useGame';
import { todayPuzzle } from './game/generator';
import { Header } from './ui/Header';
import { GameBoard } from './ui/GameBoard';
import { Toolbar } from './ui/Toolbar';
import { Toast } from './ui/Toast';
import { VictorySheet } from './ui/VictorySheet';
import { LeaderboardSheet } from './ui/LeaderboardSheet';
import { OnboardingSheet } from './ui/OnboardingSheet';
import { getStartParam, getUserId, haptic, shareResult, storage } from './lib/telegram';
import { loadStats, recordDailySolve, saveStats, type Stats } from './game/stats';
import { buildShareText } from './game/share';
import { buildReferralUrl, parseRefFromStartParam, registerFriendship } from './game/friends';
import {
  loadDailyResult,
  loadDailyResultSync,
  saveDailyResult,
  type DailyResult,
} from './game/dailyResult';
import { kyivIsoDate } from './lib/kyivDate';

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
  const initialDaily = useMemo(() => loadDailyResultSync(kyivIsoDate()), []);
  const game = useGame(initialPuzzle, initialDaily?.finalState);
  const [stats, setStats] = useState<Stats | null>(null);
  const [victoryOpen, setVictoryOpen] = useState(!!initialDaily);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => !readOnboardedFlagSync(),
  );
  const [recordedFor, setRecordedFor] = useState<string | null>(null);
  const [todayResult, setTodayResult] = useState<DailyResult | null>(initialDaily);
  // `hydrated` gates the visible board so a returning player whose
  // localStorage got evicted (iOS Telegram WebView does this sometimes)
  // doesn't see a fresh deal flash before CloudStorage resolves. If we
  // already have the sync hit, we're hydrated immediately.
  const [hydrated, setHydrated] = useState(!!initialDaily);

  // Load persisted stats once.
  useEffect(() => {
    loadStats().then(setStats);
  }, []);

  // Hydrate today's result from CloudStorage. Runs even when localStorage
  // already gave us a value — a newer copy from another device wins. The
  // board stays hidden until this resolves so players never see a fresh
  // deal before the restored state lands (storage.get caps at 1.5 s, so the
  // worst-case blank for a first-time player is bounded).
  useEffect(() => {
    loadDailyResult(kyivIsoDate()).then((r) => {
      if (r && (!initialDaily || r.finishedAt > initialDaily.finishedAt)) {
        setTodayResult(r);
        if (r.finalState) game.actions.restore(r.finalState);
        setVictoryOpen(true);
      }
      setHydrated(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick up referral on first open. Runs every launch so an existing player
  // who taps a friend's link still gets the edge registered (idempotent).
  useEffect(() => {
    const referrer = parseRefFromStartParam(getStartParam());
    if (referrer === null) return;
    const me = getUserId();
    registerFriendship(me, referrer).catch(() => void 0);
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
    // If we've loaded a saved result from an earlier session, it's a replay —
    // don't overwrite anything or re-trigger haptics.
    if (todayResult) return;

    if (stars >= 2) haptic.success();
    else if (stars === 1) haptic.warn();
    else haptic.error();
    setVictoryOpen(true);

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
  }, [status, puzzleId, stars, recordedFor, todayResult]);

  // Once today's result is saved the board is frozen — no more ops, no undo.
  const playing = status === 'playing' && !todayResult;

  // When replaying (saved result exists), pull display values from storage
  // instead of the live in-memory game which was reset on mount.
  const displayStars = todayResult?.stars ?? stars;
  const displayClosest = todayResult?.closest ?? game.closestValue.value;
  const displayDistance =
    todayResult?.distance ??
    (game.closestValue.dist === Infinity ? 0 : game.closestValue.dist);
  const displayOpsUsed = todayResult?.opsUsed ?? opsUsed;

  const onShare = async () => {
    haptic.tap();
    const text = buildShareText({
      target: puzzleState.target,
      stars,
      closest: game.closestValue.value,
      distance: game.closestValue.dist === Infinity ? 0 : game.closestValue.dist,
      opsUsed,
      dateId: puzzleState.id,
    });
    const url = buildReferralUrl(getUserId());
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

  return (
    <div className="h-dvh overflow-hidden flex flex-col safe-top">
      <TopBar
        streak={stats?.streak ?? 0}
        onOpenLeaderboard={openLeaderboard}
        onOpenHelp={openOnboarding}
      />

      <Header target={puzzleState.target} liveStars={game.liveStars} />

      {hydrated && (
        <>
          <GameBoard
            cards={game.state.puzzle.cards}
            selectedCardId={game.selectedCardId}
            selectedOp={game.selectedOp}
            previewResults={game.previewResults}
            target={game.target}
            playing={playing}
            onPickCard={game.actions.pickCard}
            onPickOp={game.actions.pickOp}
          />

          <Toolbar
            canUndo={game.state.puzzle.history.length > 0 && playing}
            canFinish={playing && game.liveStars > 0}
            onUndo={game.actions.undo}
            onFinish={game.actions.finish}
          />
        </>
      )}

      <Toast message={game.state.toast} onDone={game.actions.clearToast} />

      <VictorySheet
        open={victoryOpen}
        stars={displayStars}
        distance={displayDistance}
        target={puzzleState.target}
        closest={displayClosest}
        opsUsed={displayOpsUsed}
        onShare={onShare}
        onClose={() => setVictoryOpen(false)}
      />

      <LeaderboardSheet
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />

      <OnboardingSheet
        open={onboardingOpen}
        target={puzzleState.target}
        onClose={closeOnboarding}
      />
    </div>
  );
}

// Bumped if the instructions change materially, so returning players see the
// updated onboarding once.
const ONBOARDED_KEY = 'onboarded:v6';

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
}: {
  streak: number;
  onOpenLeaderboard: () => void;
  onOpenHelp: () => void;
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
      </div>
    </div>
  );
}

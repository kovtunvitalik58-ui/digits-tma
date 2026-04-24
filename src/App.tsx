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
import { useUndoLimit } from './game/useUndoLimit';
import { loadDailyResult, saveDailyResult, type DailyResult } from './game/dailyResult';
import { kyivIsoDate } from './lib/kyivDate';

export default function App() {
  const initialPuzzle = useMemo(() => todayPuzzle(), []);
  const game = useGame(initialPuzzle);
  const undoLimit = useUndoLimit();
  const [stats, setStats] = useState<Stats | null>(null);
  const [victoryOpen, setVictoryOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [recordedFor, setRecordedFor] = useState<string | null>(null);
  const [todayResult, setTodayResult] = useState<DailyResult | null>(null);

  // Load persisted stats once.
  useEffect(() => {
    loadStats().then(setStats);
  }, []);

  // If today's puzzle was already finished, surface the saved result so
  // reopening the app doesn't make the player restart or lose their score.
  useEffect(() => {
    loadDailyResult(kyivIsoDate()).then((r) => {
      if (!r) return;
      setTodayResult(r);
      setVictoryOpen(true);
    });
  }, []);

  // Pick up referral on first open. Runs every launch so an existing player
  // who taps a friend's link still gets the edge registered (idempotent).
  useEffect(() => {
    const referrer = parseRefFromStartParam(getStartParam());
    if (referrer === null) return;
    const me = getUserId();
    registerFriendship(me, referrer).catch(() => void 0);
  }, []);

  // First-open onboarding. Don't bother players who already finished today —
  // their replay VictorySheet shouldn't be buried under instructions.
  useEffect(() => {
    (async () => {
      const seen = await storage.get(ONBOARDED_KEY);
      if (seen) return;
      if (await loadDailyResult(kyivIsoDate())) {
        await storage.set(ONBOARDED_KEY, '1');
        return;
      }
      setOnboardingOpen(true);
    })();
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

  const onUndo = async () => {
    const allowed = await undoLimit.consume();
    if (!allowed) return;
    game.actions.undo();
  };

  return (
    <div className="h-dvh overflow-hidden flex flex-col safe-top">
      <TopBar streak={stats?.streak ?? 0} onOpenLeaderboard={openLeaderboard} />

      <Header target={puzzleState.target} liveStars={game.liveStars} />

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
        canUndo={
          game.state.puzzle.history.length > 0 && playing && undoLimit.remaining > 0
        }
        canFinish={playing && game.liveStars > 0}
        undosLeft={undoLimit.remaining}
        onUndo={onUndo}
        onFinish={game.actions.finish}
      />

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
const ONBOARDED_KEY = 'onboarded:v1';

function TopBar({
  streak,
  onOpenLeaderboard,
}: {
  streak: number;
  onOpenLeaderboard: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 h-11">
      <div className="flex items-center gap-1 text-sm">
        <span>🔥</span>
        <span className="tabular-nums text-text font-medium">{streak}</span>
      </div>
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
  );
}

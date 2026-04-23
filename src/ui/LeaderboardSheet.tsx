import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { getFriendIds } from '../game/friends';
import { getUserId } from '../lib/telegram';

type Tab = 'friends' | 'global';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function LeaderboardSheet({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('friends');

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
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl pt-4 safe-bottom max-h-[85dvh] flex flex-col"
          >
            <div className="mx-auto mb-2 w-12 h-1.5 rounded-full bg-hint/40" />
            <h2 className="text-xl font-bold text-center px-6">Лідерборд</h2>
            <TabSwitch value={tab} onChange={setTab} />
            <div className="flex-1 min-h-[320px] overflow-y-auto px-4 pb-6">
              {tab === 'friends' ? <FriendsList /> : <GlobalList />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TabSwitch({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="mx-6 mt-4 mb-3 p-1 bg-bg/70 rounded-full grid grid-cols-2 relative">
      <motion.div
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-accent shadow-pop"
        animate={{ x: value === 'friends' ? 0 : 'calc(100% + 8px)' }}
        transition={{ type: 'spring', stiffness: 480, damping: 32 }}
      />
      {(['friends', 'global'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={
            'relative z-10 h-9 text-sm font-medium transition-colors ' +
            (value === t ? 'text-white' : 'text-hint')
          }
        >
          {t === 'friends' ? 'Друзі' : 'Глобальний'}
        </button>
      ))}
    </div>
  );
}

type Row = {
  id: string;
  rank: number;
  name: string;
  score: number | null;
  isMe?: boolean;
};

function FriendsList() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // TODO: replace with `fetch('/api/leaderboard/friends')` once backend is up.
      // For now: show the current user + locally-registered friends as placeholders.
      const me = getUserId();
      const friendIds = await getFriendIds();
      if (cancelled) return;
      const rows: Row[] = [];
      if (me !== null) {
        rows.push({ id: `u${me}`, rank: 1, name: 'Ти', score: null, isMe: true });
      }
      friendIds.forEach((fid, i) => {
        rows.push({
          id: `u${fid}`,
          rank: rows.length + 1,
          name: `Друг #${String(fid).slice(-4)}`,
          score: null,
        });
        void i;
      });
      setRows(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === null) return <SkeletonRows />;
  if (rows.length === 0) return <EmptyFriends />;
  if (rows.length === 1) {
    return (
      <>
        <RowList rows={rows} />
        <InviteHint />
      </>
    );
  }
  return <RowList rows={rows} />;
}

function GlobalList() {
  // TODO: replace with `fetch('/api/leaderboard/global?period=daily')`.
  // While there's no backend, render the empty state synchronously so
  // switching to this tab doesn't flash a skeleton or resize the sheet.
  const rows: Row[] = [];
  if (rows.length === 0) return <EmptyGlobal />;
  return <RowList rows={rows} />;
}

function RowList({ rows }: { rows: Row[] }) {
  return (
    <ul className="flex flex-col gap-1 pt-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className={
            'flex items-center gap-3 h-12 px-3 rounded-xl ' +
            (r.isMe ? 'bg-accent/15 ring-1 ring-accent/40' : 'bg-bg/40')
          }
        >
          <span className="w-6 text-center text-sm text-hint tabular-nums">{r.rank}</span>
          <Avatar name={r.name} />
          <span className="flex-1 truncate text-sm">{r.name}</span>
          <span className="text-sm font-semibold tabular-nums text-hint">
            {r.score === null ? '—' : r.score}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase() || '?';
  return (
    <div className="w-8 h-8 rounded-full bg-bg/80 ring-1 ring-white/5 flex items-center justify-center text-sm font-semibold text-hint">
      {initial}
    </div>
  );
}

function SkeletonRows() {
  return (
    <ul className="flex flex-col gap-1 pt-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="h-12 rounded-xl bg-bg/30 animate-pulse" />
      ))}
    </ul>
  );
}

function EmptyFriends() {
  return (
    <EmptyState
      title="Поки що сам"
      body="Поділися результатом — друзі що долучаться через твоє посилання з'являться тут."
    />
  );
}

function EmptyGlobal() {
  return (
    <EmptyState
      title="Глобальний лідерборд скоро"
      body="Щойно з'являться перші результати дня — побачиш топ-100 усіх гравців."
    />
  );
}

function InviteHint() {
  return (
    <p className="mt-4 text-center text-sm text-hint leading-relaxed px-4">
      Поділися сьогоднішнім результатом — друзі що відкриють гру з твого повідомлення з'являться тут автоматично.
    </p>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="pt-12 pb-6 px-6 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-bg/60 flex items-center justify-center mb-4">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-hint"
        >
          <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
          <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
          <path d="M6 3h12v8a6 6 0 0 1-12 0z" />
          <path d="M10 21h4" />
          <path d="M12 17v4" />
        </svg>
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-hint leading-relaxed">{body}</p>
    </div>
  );
}

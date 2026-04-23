import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { getFriendIds } from '../game/friends';
import { getUser, getUserDisplayName } from '../lib/telegram';
import { loadDailyResult } from '../game/dailyResult';
import { kyivIsoDate } from '../lib/kyivDate';
import type { Stars } from '../game/types';

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
  photoUrl?: string;
  stars?: Stars;
  opsUsed?: number;
  isMe?: boolean;
};

function FriendsList() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // TODO: replace with `fetch('/api/leaderboard/friends')` once backend is up.
      // For now: show the current user (with local daily result) +
      // locally-registered friends as placeholders.
      const me = getUser();
      const [friendIds, myToday] = await Promise.all([
        getFriendIds(),
        loadDailyResult(kyivIsoDate()),
      ]);
      if (cancelled) return;
      const rows: Row[] = [];
      // Always include the "me" row. Fall back to placeholder identity so the
      // player always sees their own result, even if Telegram hasn't provided
      // initDataUnsafe.user (e.g. opened in a plain browser for testing).
      rows.push({
        id: me ? `u${me.id}` : 'me',
        rank: 1,
        name: getUserDisplayName(),
        photoUrl: me?.photo_url,
        stars: myToday?.stars,
        opsUsed: myToday?.opsUsed,
        isMe: true,
      });
      friendIds.forEach((fid) => {
        rows.push({
          id: `u${fid}`,
          rank: rows.length + 1,
          name: `Друг #${String(fid).slice(-4)}`,
        });
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
          <Avatar name={r.name} photoUrl={r.photoUrl} />
          <span className="flex-1 truncate text-sm">{r.name}</span>
          <Score stars={r.stars} opsUsed={r.opsUsed} />
        </li>
      ))}
    </ul>
  );
}

function Score({ stars, opsUsed }: { stars?: Stars; opsUsed?: number }) {
  if (stars === undefined) {
    return <span className="text-sm text-hint">—</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <StarRow value={stars} />
      {opsUsed !== undefined && (
        <span className="text-xs tabular-nums text-hint">
          {opsUsed} ход{plural(opsUsed, '', 'и', 'ів')}
        </span>
      )}
    </div>
  );
}

function StarRow({ value }: { value: Stars }) {
  return (
    <span className="inline-flex items-center">
      {[1, 2, 3].map((i) => {
        const filled = i <= value;
        return (
          <svg
            key={i}
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
      })}
    </span>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const [broken, setBroken] = useState(false);
  if (photoUrl && !broken) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="w-8 h-8 rounded-full object-cover ring-1 ring-white/5"
        onError={() => setBroken(true)}
      />
    );
  }
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

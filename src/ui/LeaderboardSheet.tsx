import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { getFriendIds } from '../game/friends';
import { getUser, getUserDisplayName } from '../lib/telegram';
import { loadDailyResult, loadDailyResultSync } from '../game/dailyResult';
import { loadStats, loadStatsSync } from '../game/stats';
import { kyivIsoDate } from '../lib/kyivDate';
import type { Stars } from '../game/types';

type Tab = 'today' | 'all';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function LeaderboardSheet({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('today');

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
            className="fixed bottom-0 left-0 right-0 z-50 glass-strong glass-raise rounded-t-[32px] pt-4 safe-bottom max-h-[85dvh] flex flex-col"
          >
            <div className="mx-auto mb-2 w-12 h-1.5 rounded-full bg-white/25" />
            <h2 className="text-xl font-bold text-center px-6 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Лідерборд</h2>
            <TabSwitch value={tab} onChange={setTab} />
            <div className="flex-1 min-h-[320px] overflow-y-auto px-4 pb-6">
              <FriendsList tab={tab} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TabSwitch({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="mx-6 mt-4 mb-3 p-1 rounded-full grid grid-cols-2 relative bg-black/30 border border-white/5">
      <motion.div
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 glow-accent"
        animate={{ x: value === 'today' ? 0 : 'calc(100% + 8px)' }}
        transition={{ type: 'spring', stiffness: 480, damping: 32 }}
      />
      {(['today', 'all'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={
            'relative z-10 h-9 text-sm font-medium transition-colors ' +
            (value === t ? 'text-white' : 'text-hint')
          }
        >
          {t === 'today' ? 'Сьогодні' : 'За весь час'}
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
  /** Today's daily result — shown in the "Сьогодні" tab. */
  stars?: Stars;
  opsUsed?: number;
  /** Sum of stars earned across every solved daily — shown in "За весь час". */
  totalStars?: number;
  isMe?: boolean;
};

function FriendsList({ tab }: { tab: Tab }) {
  // Render the "me" row synchronously so the leaderboard is never blank,
  // and seed both scores (today's + all-time) so switching tabs doesn't
  // reveal an empty cell until async storage resolves.
  const me = getUser();
  const today = kyivIsoDate();
  const myTodaySync = loadDailyResultSync(today);
  const myStatsSync = loadStatsSync();
  const meRowInitial: Row = {
    id: me ? `u${me.id}` : 'me',
    rank: 1,
    name: getUserDisplayName(),
    photoUrl: me?.photo_url,
    stars: myTodaySync?.stars,
    opsUsed: myTodaySync?.opsUsed,
    totalStars: myStatsSync.totalStars,
    isMe: true,
  };
  const [rows, setRows] = useState<Row[]>([meRowInitial]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [friendIds, myToday, myStats] = await Promise.all([
        getFriendIds(),
        loadDailyResult(today),
        loadStats(),
      ]);
      if (cancelled) return;
      const next: Row[] = [
        {
          ...meRowInitial,
          stars: myToday?.stars ?? meRowInitial.stars,
          opsUsed: myToday?.opsUsed ?? meRowInitial.opsUsed,
          totalStars: myStats.totalStars,
        },
      ];
      friendIds.forEach((fid) => {
        next.push({
          id: `u${fid}`,
          rank: next.length + 1,
          name: `Друг #${String(fid).slice(-4)}`,
        });
      });
      setRows(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // All-time view ranks rows by totalStars (descending). Today view keeps
  // the server-assigned order (self first, then friends).
  const viewRows =
    tab === 'all'
      ? [...rows]
          .sort((a, b) => (b.totalStars ?? 0) - (a.totalStars ?? 0))
          .map((r, i) => ({ ...r, rank: i + 1 }))
      : rows;

  if (rows.length === 1) {
    return (
      <>
        <RowList rows={viewRows} tab={tab} />
        <InviteHint />
      </>
    );
  }
  return <RowList rows={viewRows} tab={tab} />;
}

function RowList({ rows, tab }: { rows: Row[]; tab: Tab }) {
  return (
    <ul className="flex flex-col gap-1 pt-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className={
            'flex items-center gap-3 h-12 px-3 rounded-2xl ' +
            (r.isMe
              ? 'bg-gradient-to-r from-indigo-500/25 to-violet-500/15 border border-indigo-400/40'
              : 'glass')
          }
        >
          <span className="w-6 text-center text-sm text-hint tabular-nums">{r.rank}</span>
          <Avatar name={r.name} photoUrl={r.photoUrl} />
          <span className="flex-1 truncate text-sm">{r.name}</span>
          {tab === 'today' ? (
            <TodayScore stars={r.stars} opsUsed={r.opsUsed} />
          ) : (
            <AllTimeScore totalStars={r.totalStars} />
          )}
        </li>
      ))}
    </ul>
  );
}

function TodayScore({ stars, opsUsed }: { stars?: Stars; opsUsed?: number }) {
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

function AllTimeScore({ totalStars }: { totalStars?: number }) {
  if (totalStars === undefined) {
    return <span className="text-sm text-hint">—</span>;
  }
  return (
    <div className="flex items-center gap-1">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="#fbbf24"
        stroke="#fbbf24"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      <span className="text-sm font-semibold tabular-nums">{totalStars}</span>
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
        className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
        onError={() => setBroken(true)}
      />
    );
  }
  const initial = name.charAt(0).toUpperCase() || '?';
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-500/40 ring-1 ring-white/10 flex items-center justify-center text-sm font-semibold text-text">
      {initial}
    </div>
  );
}

function InviteHint() {
  return (
    <p className="mt-4 text-center text-sm text-hint leading-relaxed px-4">
      Поділися сьогоднішнім результатом — друзі що відкриють гру з твого повідомлення з'являться тут автоматично.
    </p>
  );
}

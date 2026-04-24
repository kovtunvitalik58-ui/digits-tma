import type { Stars } from './types';

type ShareInput = {
  target: number;
  stars: Stars;
  closest: number | null;
  distance: number;
  opsUsed: number;
  dateId: string;
};

const STAR_FILLED = '⭐';
const STAR_EMPTY = '☆';

function starLine(stars: Stars): string {
  return Array.from({ length: 3 }, (_, i) => (i < stars ? STAR_FILLED : STAR_EMPTY)).join('');
}

function movesWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'хід';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ходи';
  return 'ходів';
}

const MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

/** "2026-04-24" → "24 квітня". Falls back to the raw id if parsing fails. */
function prettyDate(dateId: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateId);
  if (!match) return dateId;
  const day = parseInt(match[3], 10);
  const month = parseInt(match[2], 10) - 1;
  const name = MONTHS_GENITIVE[month];
  if (!name) return dateId;
  return `${day} ${name}`;
}

/** Assemble the share text for a completed puzzle. Tone is casual and
 *  slightly boastful on a win, self-deprecating on a miss — reads more
 *  like a friend's message than a receipt. */
export function buildShareText({
  target,
  stars,
  closest,
  distance,
  opsUsed,
  dateId,
}: ShareInput): string {
  const header = `Digits · ${prettyDate(dateId)}  ${starLine(stars)}`;
  const movesLine = `${opsUsed} ${movesWord(opsUsed)}`;

  // Exact hit — lead with the celebration line, skip the "пройшло на N" line.
  if (distance === 0 && stars === 3) {
    return [header, `${target} = ${target} ✨  за ${movesLine}`, '', 'Спробуй сам:'].join('\n');
  }

  // Missed entirely (board wiped before any viable card).
  if (closest === null) {
    return [header, `ціль ${target} · сьогодні повз`, '', 'Спробуй ти:'].join('\n');
  }

  // Normal case — got close but not exact.
  const gap = distance === 0 ? '' : `  (±${distance})`;
  return [
    header,
    `ціль ${target} → ${closest}${gap} · ${movesLine}`,
    '',
    'Спробуй сам:',
  ].join('\n');
}

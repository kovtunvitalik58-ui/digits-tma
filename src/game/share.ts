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

export function buildShareText({
  target,
  stars,
  closest,
  distance,
  opsUsed,
  dateId,
}: ShareInput): string {
  const lines = [
    `Digits · ${dateId}`,
    `🎯 ${target}  ${starLine(stars)}`,
  ];
  if (distance === 0) {
    lines.push(`${opsUsed} ${movesWord(opsUsed)} · точне влучення!`);
  } else if (closest !== null) {
    lines.push(`${opsUsed} ${movesWord(opsUsed)} · ${closest} (за ${distance})`);
  } else {
    lines.push(`${opsUsed} ${movesWord(opsUsed)}`);
  }
  return lines.join('\n');
}

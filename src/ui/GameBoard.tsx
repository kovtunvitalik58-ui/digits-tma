import type { NumberCard, Op } from '../game/types';
import { NumberCardView } from './NumberCardView';
import { OpButton } from './OpButton';
import { OPS } from '../game/ops';
import type { PreviewMap } from '../game/useGame';
import type { Hint } from '../game/hint';

type Props = {
  cards: NumberCard[];
  selectedCardId: string | null;
  selectedOp: Op | null;
  previewResults: PreviewMap;
  target: number;
  playing: boolean;
  /** When set, the matching two cards and the op button glow amber to
   *  point the player at the suggested next move. */
  hint?: Hint | null;
  onPickCard: (id: string) => void;
  onPickOp: (op: Op) => void;
};

export function GameBoard({
  cards,
  selectedCardId,
  selectedOp,
  previewResults,
  target,
  playing,
  hint,
  onPickCard,
  onPickOp,
}: Props) {
  const hasSelection = selectedCardId !== null;

  const cols = 3;
  const rows = Math.max(2, Math.ceil(cards.length / cols));

  return (
    <div className="flex-1 min-h-0 flex flex-col px-5 pb-3">
      <div className="flex-1 min-h-0 flex items-start justify-center">
        <div
          className="grid grid-cols-3 gap-2.5 w-full mx-auto"
          style={{
            aspectRatio: `${cols} / ${rows}`,
            maxWidth: '420px',
            // Cap so the grid never hits the ops row. 22rem covers topbar
            // (2.75rem) + header (~9rem) + ops+toolbar (~9rem) + safe margin.
            maxHeight: 'calc(100dvh - 22rem)',
          }}
        >
          {cards.map((c) => {
            const preview = previewResults.has(c.id)
              ? previewResults.get(c.id) ?? null
              : undefined;
            const isHinted =
              !!hint && (hint.leftId === c.id || hint.rightId === c.id);
            return (
              <NumberCardView
                key={c.id}
                card={c}
                selected={selectedCardId === c.id}
                frozen={!playing}
                preview={preview}
                winning={preview !== undefined && preview !== null && preview === target}
                hinted={isHinted}
                onPick={onPickCard}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        {OPS.map((op) => (
          <OpButton
            key={op}
            op={op}
            selected={selectedOp === op}
            enabled={playing && hasSelection}
            hinted={hint?.op === op}
            onPick={onPickOp}
          />
        ))}
      </div>
    </div>
  );
}

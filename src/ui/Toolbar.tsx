type Props = {
  canUndo: boolean;
  canFinish: boolean;
  canHint: boolean;
  /** True while a hint is currently glowing on the board — flips the icon
   *  state so the player can see at a glance whether a hint is active. */
  hintActive: boolean;
  onUndo: () => void;
  onFinish: () => void;
  onHint: () => void;
};

export function Toolbar({
  canUndo,
  canFinish,
  canHint,
  hintActive,
  onUndo,
  onFinish,
  onHint,
}: Props) {
  return (
    <div className="flex items-center justify-center gap-2.5 pt-2 pb-4">
      <ToolButton label="Відмінити" disabled={!canUndo} onClick={onUndo}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
        </svg>
      </ToolButton>
      <ToolButton label="Підказка" disabled={!canHint} onClick={onHint} highlight={hintActive}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5C17.7 10.2 18 9.5 18 8a6 6 0 0 0-12 0c0 1.5.5 2.2 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
        </svg>
      </ToolButton>
      <ToolButton label="Завершити" disabled={!canFinish} onClick={onFinish} accent>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </ToolButton>
    </div>
  );
}

function ToolButton({
  label,
  disabled,
  accent,
  highlight,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  accent?: boolean;
  /** Amber outline + glow — used to indicate "the hint you asked for is
   *  still showing on the board". Independent of accent (the green
   *  Завершити CTA). */
  highlight?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base =
    'relative flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium overflow-hidden transition-all';
  const state = disabled
    ? 'glass text-hint/60 opacity-60'
    : accent
      ? 'bg-accent-fill text-white glow-accent border border-white/25 active:brightness-110'
      : highlight
        ? 'glass glass-raise text-amber-200 ring-2 ring-amber-300/80 glow-amber active:brightness-110'
        : 'glass glass-raise text-text active:brightness-110';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={base + ' ' + state}
    >
      {!disabled && !highlight && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none"
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        {children}
        <span>{label}</span>
      </span>
    </button>
  );
}

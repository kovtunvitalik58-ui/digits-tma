type Props = {
  canUndo: boolean;
  canFinish: boolean;
  onUndo: () => void;
  onFinish: () => void;
};

export function Toolbar({ canUndo, canFinish, onUndo, onFinish }: Props) {
  return (
    <div className="flex items-center justify-center gap-2.5 pt-2 pb-4">
      <ToolButton label="Відмінити" disabled={!canUndo} onClick={onUndo}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
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
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base =
    'relative flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium overflow-hidden transition-all';
  const state = disabled
    ? 'glass text-hint/60 opacity-60'
    : accent
      ? 'bg-accent-fill text-white glow-accent border border-white/25 active:brightness-110'
      : 'glass glass-raise text-text active:brightness-110';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={base + ' ' + state}
    >
      {!disabled && (
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

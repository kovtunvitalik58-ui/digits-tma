type Props = {
  canUndo: boolean;
  canFinish: boolean;
  undosLeft: number;
  onUndo: () => void;
  onFinish: () => void;
};

export function Toolbar({ canUndo, canFinish, undosLeft, onUndo, onFinish }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2 pb-4">
      <ToolButton
        label="Відмінити"
        badge={String(undosLeft)}
        disabled={!canUndo}
        onClick={onUndo}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
        </svg>
      </ToolButton>
      <ToolButton label="Завершити" disabled={!canFinish} onClick={onFinish} accent>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </ToolButton>
    </div>
  );
}

function ToolButton({
  label,
  badge,
  disabled,
  accent,
  onClick,
  children,
}: {
  label: string;
  badge?: string;
  disabled?: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={badge ? `${label} (${badge} лишилось)` : label}
      className={
        'flex items-center gap-1.5 h-9 px-3 rounded-full text-sm ' +
        (disabled
          ? 'bg-surface/50 text-hint/60'
          : accent
            ? 'bg-accent text-white shadow-pop active:brightness-110'
            : 'bg-surface text-text shadow-card active:brightness-110')
      }
    >
      {children}
      <span>{label}</span>
      {badge !== undefined && (
        <span className="ml-0.5 text-xs tabular-nums opacity-60">{badge}</span>
      )}
    </button>
  );
}

export function Ring({
  value,
  size = 96,
  stroke = 8,
  color = "var(--accent)",
  label,
  sublabel,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const offset = c - (v / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-3)"
          strokeWidth={stroke}
        />
        {value != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular text-[var(--text-0)]">
          {value == null ? "—" : `${Math.round(value)}%`}
        </span>
        {sublabel && <span className="text-[10px] text-[var(--text-2)] mt-0.5">{sublabel}</span>}
      </div>
      {label && (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-[var(--text-2)] whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  );
}

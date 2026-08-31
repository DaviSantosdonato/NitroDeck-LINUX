export function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full shrink-0 transition-colors disabled:opacity-40"
      style={{ background: checked ? "var(--accent)" : "var(--bg-3)" }}
    >
      <span
        className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: checked ? 22 : 4 }}
      />
    </button>
  );
}

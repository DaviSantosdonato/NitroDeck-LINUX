export function pct(v: number | null, digits = 0) {
  if (v == null) return "—";
  return `${v.toFixed(digits)}%`;
}

export function celsius(v: number | null) {
  if (v == null) return "—";
  return `${Math.round(v)}°C`;
}

export function watts(v: number | null, digits = 1) {
  if (v == null) return "—";
  return `${v.toFixed(digits)} W`;
}

export function mhz(v: number | null) {
  if (v == null) return "—";
  return `${(v / 1000).toFixed(2)} GHz`;
}

export function mb(v: number | null) {
  if (v == null) return "—";
  if (v >= 1024) return `${(v / 1024).toFixed(1)} GB`;
  return `${Math.round(v)} MB`;
}

export function minutes(v: number | null) {
  if (v == null) return "—";
  const h = Math.floor(v / 60);
  const m = Math.round(v % 60);
  return `${h}h ${m}min`;
}

export function relativeTime(epochMs: number) {
  const diff = Date.now() - epochMs;
  if (diff < 1500) return "agora";
  return `${Math.round(diff / 1000)}s atrás`;
}

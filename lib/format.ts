/** Timestamps arrive as Date (pg timestamptz) or ISO strings. */
export function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

export function fmtDateTime(v: string | Date): string {
  return toDate(v).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtRelative(v: string | Date): string {
  const diffMs = toDate(v).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [1000 * 60 * 60 * 24, "day"],
    [1000 * 60 * 60, "hour"],
    [1000 * 60, "minute"],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [ms, unit] of units) {
    if (abs >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return "just now";
}

export function isPast(v: string | Date): boolean {
  return toDate(v).getTime() < Date.now();
}

/** Value for <input type="datetime-local" defaultValue> from a Date. */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

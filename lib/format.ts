/**
 * All wall-clock times in the app are IST (teachers and students are in
 * India), while storage is UTC. The server may run in any timezone (Render
 * uses UTC), so never rely on the process-local zone: parse form input as
 * IST via fromISTInputValue and render via the helpers here.
 */
export const APP_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30"; // IST is fixed; no DST

/** Timestamps arrive as Date (pg timestamptz) or ISO strings. */
export function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

export function fmtDateTime(v: string | Date): string {
  return toDate(v).toLocaleString("en-IN", {
    timeZone: APP_TIME_ZONE,
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

/** Parse an <input type="datetime-local"> value as IST wall-clock → UTC ISO string. */
export function fromISTInputValue(value: string): string {
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return new Date(`${withSeconds}${IST_OFFSET}`).toISOString();
}

/** Value for <input type="datetime-local" defaultValue>: the Date's IST wall-clock. */
export function toLocalInputValue(d: Date): string {
  // sv-SE formats as "YYYY-MM-DD HH:mm" — exactly datetime-local shape after the swap.
  return d
    .toLocaleString("sv-SE", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(" ", "T");
}

/**
 * Formats how long ago `occurredAt` was, relative to `asOf` — the dataset's
 * own newest interaction, not the wall clock. Same reasoning as
 * COLD_THRESHOLD_DAYS in metrics.ts: the seed data ends mid-2026, so
 * `Date.now()` would make everything read as "N months ago".
 */
export function relativeTime(occurredAt: string, asOf: string): string {
  const diffMs = new Date(asOf).getTime() - new Date(occurredAt).getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

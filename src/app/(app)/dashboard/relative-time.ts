/**
 * Formats how long ago `occurredAt` was, relative to `asOf` — the dataset's
 * own newest interaction, not the wall clock. Same reasoning as
 * COLD_THRESHOLD_DAYS in metrics.ts: the seed data ends mid-2026, so
 * `Date.now()` would make everything read as "N months ago".
 *
 * Uses Intl.RelativeTimeFormat rather than hand-built strings: Russian
 * needs three plural forms ("1 день / 2 дня / 5 дней") and Italian its own
 * two, and the platform already knows all of them per locale.
 */
export function relativeTime(occurredAt: string, asOf: string, locale: string = "en"): string {
  const diffMs = new Date(asOf).getTime() - new Date(occurredAt).getTime();
  const minutes = Math.round(diffMs / 60_000);

  // "numeric: auto" lets each locale use its own idiom where it has one
  // ("yesterday" / "ieri" / "вчера") instead of a bare "1 day ago".
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });

  if (minutes < 1) return rtf.format(0, "second");
  if (minutes < 60) return rtf.format(-minutes, "minute");

  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");

  const days = Math.round(hours / 24);
  if (days < 30) return rtf.format(-days, "day");

  return rtf.format(-Math.round(days / 30), "month");
}

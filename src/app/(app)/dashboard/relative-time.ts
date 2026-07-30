/**
 * Formats how long ago `occurredAt` was, relative to whatever `asOf` the
 * caller supplies — deliberately not hardcoded, because the dashboard needs
 * both anchors. Measures *within* the history (days per stage, cold for 14+
 * days) pass the dataset's own newest event, otherwise a fixture that ends
 * mid-2026 marks everything stale. Recent activity passes the wall clock,
 * because a reader takes "now" literally and would otherwise be told a
 * three-week-old event just happened.
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

/** The one date format used everywhere a record shows its date: "9 apr 2026"
 * in the viewer's locale. Was copy-pasted into four screens before being
 * extracted here. */
export function fmtDate(value: string | Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

/** Same, plus time — for interactions and stage history, where two entries
 * can share a day and the order matters. */
export function fmtDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

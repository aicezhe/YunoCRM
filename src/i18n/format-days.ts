/**
 * Picks the grammatically correct message for an average-days figure.
 *
 * Russian quirk this exists for: a non-integer quantity always takes the
 * genitive singular ("1,1 дня", "13,7 дня"), never the one/few/many
 * categories that apply to whole numbers ("2 дня" vs "5 дней"). CLDR routes
 * every fractional value to the same "other" plural category, which would
 * read as "13,7 дней" — wrong — if left to the normal ICU plural message.
 * English and Italian have no such rule: "13.7 days" / "13,7 giorni" are
 * already correct however ICU pluralizes them.
 */
export function avgDaysKey(days: number, locale: string): "avgDaysFraction" | "avgDays" {
  return locale === "ru" && !Number.isInteger(days) ? "avgDaysFraction" : "avgDays";
}

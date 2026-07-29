/** Supported UI locales. English is the default and the fallback. */
export const LOCALES = ["en", "it", "ru"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Name of the cookie the locale is stored in — read on the server in
 * i18n/request.ts, written by the switcher's server action. */
export const LOCALE_COOKIE = "locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  it: "Italiano",
  ru: "Русский",
};

/** Short label for the switcher trigger, where space is tight. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  it: "IT",
  ru: "RU",
};

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}

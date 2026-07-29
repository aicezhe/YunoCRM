import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./locales";

/**
 * Resolves the request's locale from a cookie rather than the URL, so no
 * route path changes and src/proxy.ts (auth) needs no awareness of i18n.
 *
 * An unknown or missing cookie value falls back to English instead of
 * throwing — a stale cookie from an older build must never 500 a page.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

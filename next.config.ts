import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
};

// next-intl in its "without i18n routing" mode: the locale lives in a
// cookie, not in the URL. Deliberate — every route path stays exactly as
// it was, so src/proxy.ts (auth redirects) and every <Link> keep working
// untouched. No i18n middleware is involved at all.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

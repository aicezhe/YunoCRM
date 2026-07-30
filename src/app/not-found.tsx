import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Root-level 404. Lives outside the (app) group so it also covers URLs that
 * never matched a route at all — those don't reach the authenticated layout,
 * so this deliberately links to /login rather than assuming a session.
 */
export default async function NotFound() {
  const t = await getTranslations("errorPage");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#FCFBFF] px-5 text-center font-sans">
      <span className="text-lg font-semibold tracking-tight text-[#5B4FE9]">
        Yuno<span className="text-gray-900">CRM</span>
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-gray-900">{t("notFoundTitle")}</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">{t("notFoundBody")}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex min-h-10 items-center rounded-2xl bg-[#5B4FE9] px-4 text-sm font-semibold text-white transition hover:bg-[#4B3FE0]"
      >
        {t("backToDashboard")}
      </Link>
    </main>
  );
}

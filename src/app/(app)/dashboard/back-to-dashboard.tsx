import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";

/**
 * Back link for the four dashboard detail screens. They sit *inside*
 * Dashboard rather than being nav destinations of their own, so — unlike
 * Quarantine and Users — the sidebar/bottom nav offers no way back up.
 */
export function BackToDashboard() {
  const t = useTranslations("nav");
  return (
    <Link
      href="/dashboard"
      className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-[#5B4FE9] sm:min-h-0"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2} />
      {t("backToDashboard")}
    </Link>
  );
}

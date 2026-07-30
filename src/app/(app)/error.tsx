"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

/**
 * Catches anything the data layer didn't. Every query returns an explicit
 * error state that its screen renders, so reaching here means a genuine
 * unexpected throw — this exists so that path ends in a usable screen with a
 * way out rather than Next's bare "Application error" in production.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-5 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{t("title")}</h1>
      <p className="mt-2 text-sm text-gray-500">{t("body")}</p>

      {/* The digest is the only handle on a production stack trace, which is
          intentionally not shown to the user — worth surfacing so a bug
          report can be tied to a server log line. */}
      {error.digest && <p className="mt-3 font-mono text-xs text-gray-400">{t("reference", { digest: error.digest })}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-[#5B4FE9] px-4 text-sm font-semibold text-white transition hover:bg-[#4B3FE0]"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2} />
          {t("retry")}
        </button>
        <Link
          href="/dashboard"
          className="inline-flex min-h-10 items-center rounded-2xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          {t("backToDashboard")}
        </Link>
      </div>
    </div>
  );
}

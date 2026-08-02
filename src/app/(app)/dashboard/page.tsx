import { Suspense } from "react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Calendar, Mail, Phone, StickyNote, type LucideIcon } from "lucide-react";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { AccessDeniedToast } from "./access-denied-toast";
import { SectionCard } from "./section-card";
import {
  getDataAsOf,
  getRecentActivity,
  getSourceMetric,
  getStageMetric,
  getTimeMetric,
  getWitheringMetric,
  type Metric,
} from "./metrics";
import { relativeTime } from "./relative-time";
import { fmtDate } from "@/i18n/format-dates";

const TYPE_ICON: Record<string, LucideIcon> = { email: Mail, call: Phone, meeting: Calendar, note: StickyNote };
const KNOWN_TYPES = ["email", "call", "meeting", "note"];

/** Normalizes a Metric's ok/empty/error states into a value+caption pair a
 * card can always render, instead of branching per card. The caption key
 * and its params come from metrics.ts; ICU picks the plural form here,
 * where the locale is known. */
function metricDisplay(
  metric: Metric,
  t: (key: string, values?: Record<string, number>) => string
): { value: string; caption: string } {
  if (metric.state === "ok") return { value: metric.value, caption: t(metric.captionKey, metric.captionParams) };
  if (metric.state === "empty") return { value: "–", caption: t(metric.captionKey) };
  return { value: "–", caption: t("unavailable") };
}

/** First name only, for the greeting — getCurrentAppUser() carries the full
 * name since Sidebar/BottomNav show that instead. */
function firstNameOf(appUser: Awaited<ReturnType<typeof getCurrentAppUser>>): string {
  if (!appUser) return "there";
  return appUser.name.split(" ")[0] || appUser.email.split("@")[0];
}

async function AsOfNote() {
  const [asOf, t, locale] = await Promise.all([getDataAsOf(), getTranslations("dashboard"), getLocale()]);
  if (!asOf) return null;
  return <p className="mt-1 text-sm text-gray-400">{t("asOf", { date: fmtDate(asOf, locale) })}</p>;
}

async function RecentActivity() {
  const [report, asOf, t, locale] = await Promise.all([
    getRecentActivity(5),
    getDataAsOf(),
    getTranslations("dashboard"),
    getLocale(),
  ]);

  // "Now" for this feed is pinned three days after the dataset's newest
  // event, not the wall clock. The fixture is frozen in July 2026, so
  // against the real clock every entry reads "N weeks ago" and drifts
  // further daily — the feed looked abandoned when the point of it is what
  // the workspace's last days looked like. Derived from the data rather
  // than hardcoded, so reloading a different dataset moves it along.
  const now = asOf ? new Date(asOf.getTime() + 3 * 86_400_000).toISOString() : new Date().toISOString();

  if (report.state === "error") {
    return (
      <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
        {t("activityError")}
      </p>
    );
  }
  if (report.state === "empty") {
    return (
      <p className="rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
        {t("activityEmpty")}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)]">
      {report.items.map((item) => {
        const Icon = TYPE_ICON[item.type] ?? StickyNote;
        // One key per type+direction rather than "direction" + "type":
        // in Russian the adjective agrees with the noun's gender, so
        // concatenating produces "исходящее встреча" instead of
        // "исходящая встреча".
        const label = KNOWN_TYPES.includes(item.type)
          ? t(`activity.${item.type}${item.direction ? `_${item.direction}` : ""}`)
          : item.type;
        return (
          <li key={item.id}>
            <Link
              href={`/companies/${item.companyId}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#5B4FE9]/[0.04]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5B4FE9]/10 text-[#5B4FE9]">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                <span className="font-medium">{item.companyName}</span>
                <span className="text-gray-400"> — {label}</span>
              </span>
              <span className="shrink-0 text-xs text-gray-400">
                {relativeTime(item.occurredAt, now, locale)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RecentActivitySkeleton() {
  return (
    <div className="animate-pulse space-y-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-8 rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  // getCurrentAppUser() is cache()'d — this call reuses the layout's fetch
  // for the same request instead of paying for auth.getUser() a second time.
  const [appUser, t, sourceMetric, stageMetric, timeMetric, witheringMetric] = await Promise.all([
    getCurrentAppUser(),
    getTranslations("dashboard"),
    getSourceMetric(),
    getStageMetric(),
    getTimeMetric(),
    getWitheringMetric(),
  ]);
  const name = firstNameOf(appUser);

  const sections = [
    { href: "/dashboard/source", title: t("cardSource"), motif: "source" as const, ...metricDisplay(sourceMetric, t) },
    { href: "/dashboard/by-stage", title: t("cardStage"), motif: "stage" as const, ...metricDisplay(stageMetric, t) },
    { href: "/dashboard/time", title: t("cardTime"), motif: "time" as const, ...metricDisplay(timeMetric, t) },
    { href: "/dashboard/withering", title: t("cardWithering"), motif: "withering" as const, ...metricDisplay(witheringMetric, t) },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 sm:px-6">
      <Suspense fallback={null}>
        <AccessDeniedToast />
      </Suspense>

      <div className="pt-6 pb-8 sm:pt-8 sm:pb-10">
        <h1 className="text-3xl font-semibold tracking-tight break-words text-gray-900 sm:text-4xl lg:text-5xl">
          {t("greeting", { name })}
        </h1>
        <Suspense fallback={null}>
          <AsOfNote />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {sections.map((section) => (
          <SectionCard
            key={section.href}
            href={section.href}
            title={section.title}
            value={section.value}
            caption={section.caption}
            motif={section.motif}
          />
        ))}
      </div>

      <div className="mt-8 mb-12 sm:mt-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">{t("recentActivity")}</h2>
        <Suspense fallback={<RecentActivitySkeleton />}>
          <RecentActivity />
        </Suspense>
      </div>
    </div>
  );
}

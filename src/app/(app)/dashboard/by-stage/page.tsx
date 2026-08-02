import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BackToDashboard } from "../back-to-dashboard";
import { channelLabel } from "@/i18n/channel-labels";
import { getStageReport } from "./queries";
import { FunnelChart } from "./funnel-chart";

export default async function ByStagePage() {
  const [report, t, tChannel] = await Promise.all([
    getStageReport(),
    getTranslations("byStageScreen"),
    getTranslations("channels"),
  ]);

  return (
    <>
      <div className="mx-auto max-w-5xl px-5 pt-4 sm:px-6 sm:pt-6">
        <BackToDashboard />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-xl text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="mx-auto max-w-5xl px-5 pt-6 pb-4 sm:px-6">
        {report.state === "error" && (
          <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{t("error")}</p>
        )}
        {report.state === "empty" && (
          <p className="rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">{t("empty")}</p>
        )}
        {report.state === "ok" && (
          <>
            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)] sm:p-6">
              <p className="mb-4 text-sm text-gray-400">{t("totalProspects", { count: report.total })}</p>
              <FunnelChart stages={report.stages} />
            </div>

            <section className="mt-8">
              <h2 className="text-xl font-semibold tracking-tight text-gray-900">{t("lostTitle")}</h2>
              <p className="mt-1 text-sm text-gray-500">{t("lostSubtitle")}</p>

              {report.lost.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
                  {t("lostEmpty")}
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {report.lost.map((row) => (
                    <li key={row.companyId}>
                      <Link
                        href={`/companies/${row.companyId}`}
                        className="block rounded-2xl border border-gray-100 border-l-4 border-l-red-400 bg-white px-5 py-4 shadow-[0_14px_32px_-28px_rgba(91,79,233,0.5)] transition hover:border-l-red-500 hover:bg-red-50/30"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="font-medium text-gray-900">{row.companyName}</span>
                          <span className="text-xs text-gray-400">{channelLabel(tChannel, row.channel)}</span>
                        </div>
                        {/* The reason is the point of this list — it gets the
                            visual weight, not the company name. */}
                        <p className="mt-1.5 text-base font-semibold text-red-700">{row.reason}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

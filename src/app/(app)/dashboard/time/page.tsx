import { getLocale, getTranslations } from "next-intl/server";
import { BackToDashboard } from "../back-to-dashboard";
import { getTimeReport, type StageDuration } from "./queries";
import { avgDaysKey } from "@/i18n/format-days";

function DurationTable({
  stages,
  t,
  tStage,
  locale,
}: {
  stages: StageDuration[];
  t: (key: string, values?: Record<string, number>) => string;
  tStage: (key: string) => string;
  locale: string;
}) {
  const longest = Math.max(0, ...stages.map((s) => s.avgDays ?? 0));

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-medium tracking-wide text-gray-400 uppercase">
              <th className="px-5 py-4">{t("colStage")}</th>
              <th className="px-5 py-4">{t("colAvgDays")}</th>
              <th className="px-5 py-4">{t("colCompleted")}</th>
              <th className="px-5 py-4">{t("colOngoing")}</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((row, i) => {
              const isLongest = row.avgDays !== null && row.avgDays === longest && longest > 0;
              return (
                <tr
                  key={row.stage}
                  className={
                    (i !== stages.length - 1 ? "border-b border-gray-50 " : "") + (isLongest ? "bg-red-50/50" : "")
                  }
                >
                  <td className="px-5 py-4 font-medium text-gray-900">{tStage(row.stage)}</td>
                  <td className={"px-5 py-4 font-semibold " + (isLongest ? "text-red-600" : "text-gray-900")}>
                    {row.avgDays !== null ? t(avgDaysKey(row.avgDays, locale), { count: row.avgDays }) : "–"}
                  </td>
                  <td className="px-5 py-4 text-gray-600">{row.completed}</td>
                  <td className="px-5 py-4 text-gray-600">{row.ongoing}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function TimePage() {
  const [report, t, tStage, locale] = await Promise.all([
    getTimeReport(),
    getTranslations("timeScreen"),
    getTranslations("stages"),
    getLocale(),
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
          <div className="space-y-3">
            <DurationTable stages={report.stages} t={t} tStage={tStage} locale={locale} />
            <p className="px-1 text-xs text-gray-400">{t("footnote")}</p>
          </div>
        )}
      </div>
    </>
  );
}

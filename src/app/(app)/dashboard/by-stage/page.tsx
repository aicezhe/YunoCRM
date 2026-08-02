import { getTranslations } from "next-intl/server";
import { BackToDashboard } from "../back-to-dashboard";
import { getStageReport } from "./queries";
import { FunnelChart } from "./funnel-chart";

export default async function ByStagePage() {
  const [report, t] = await Promise.all([getStageReport(), getTranslations("byStageScreen")]);

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
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)] sm:p-6">
            <p className="mb-4 text-sm text-gray-400">{t("totalProspects", { count: report.total })}</p>
            <FunnelChart stages={report.stages} />
          </div>
        )}
      </div>
    </>
  );
}

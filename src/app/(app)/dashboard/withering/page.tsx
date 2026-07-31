import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BackToDashboard } from "../back-to-dashboard";
import { channelLabel } from "@/i18n/channel-labels";
import { getWitheringReport } from "./queries";

export default async function WitheringPage() {
  const [report, t, tStage, tChannel] = await Promise.all([
    getWitheringReport(),
    getTranslations("witheringScreen"),
    getTranslations("stages"),
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
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-6 text-sm text-gray-600 shadow-sm">
            <PartyPopper className="h-5 w-5 shrink-0 text-[#5B4FE9]" strokeWidth={1.75} />
            {t("empty")}
          </div>
        )}
        {report.state === "ok" && (
          <>
            {/* Below sm the five columns can't fit, and sideways scrolling
                hides the one number the screen exists to show. Same rows,
                stacked: how cold leads, the rest supports it. */}
            <ul className="space-y-3 md:hidden">
              {report.rows.map((row) => (
                <li key={row.prospectId}>
                  <Link
                    href={`/companies/${row.companyId}`}
                    className="block rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-[0_14px_32px_-28px_rgba(91,79,233,0.5)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-medium text-gray-900">{row.companyName}</p>
                      <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                        {t("daysCold", { count: row.daysCold })}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                        {tStage(row.currentStage)}
                      </span>
                      <span>{channelLabel(tChannel, row.channel)}</span>
                    </div>
                    {/* Labelled, unlike the table: with no column header above
                        it, a bare name reads as anything. */}
                    <p className="mt-1 text-xs text-gray-400">
                      {t("colOwner")}: {row.ownerName ?? t("unassigned")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)] md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium tracking-wide text-gray-400 uppercase">
                    <th className="px-5 py-4">{t("colCompany")}</th>
                    <th className="px-5 py-4">{t("colStage")}</th>
                    <th className="px-5 py-4">{t("colOwner")}</th>
                    <th className="px-5 py-4">{t("colChannel")}</th>
                    <th className="px-5 py-4">{t("colDaysCold")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr
                      key={row.prospectId}
                      className={
                        "group cursor-pointer hover:bg-[#5B4FE9]/[0.03] " +
                        (i !== report.rows.length - 1 ? "border-b border-gray-50" : "")
                      }
                    >
                      <td className="p-0">
                        <Link
                          href={`/companies/${row.companyId}`}
                          className="block px-5 py-4 font-medium text-gray-900 group-hover:text-[#5B4FE9]"
                        >
                          {row.companyName}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={`/companies/${row.companyId}`} className="block px-5 py-4 text-gray-600">
                          {tStage(row.currentStage)}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={`/companies/${row.companyId}`} className="block px-5 py-4 text-gray-600">
                          {row.ownerName ?? t("unassigned")}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={`/companies/${row.companyId}`} className="block px-5 py-4 text-gray-600">
                          {channelLabel(tChannel, row.channel)}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link
                          href={`/companies/${row.companyId}`}
                          className="block px-5 py-4 font-semibold text-red-600"
                        >
                          {t("daysCold", { count: row.daysCold })}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTimeReport, type StageDuration } from "./queries";

function DurationTable({ stages }: { stages: StageDuration[] }) {
  const longest = Math.max(0, ...stages.map((s) => s.avgDays ?? 0));

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-medium tracking-wide text-gray-400 uppercase">
              <th className="px-5 py-4">Stage</th>
              <th className="px-5 py-4">Avg. days before moving on</th>
              <th className="px-5 py-4">Completed transitions</th>
              <th className="px-5 py-4">Ongoing (still here)</th>
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
                  <td className="px-5 py-4 font-medium text-gray-900">{row.stage}</td>
                  <td className={"px-5 py-4 font-semibold " + (isLongest ? "text-red-600" : "text-gray-900")}>
                    {row.avgDays !== null ? `${row.avgDays} days` : "–"}
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
  const report = await getTimeReport();

  return (
    <>
      <div className="mx-auto max-w-5xl px-5 pt-4 sm:px-6 sm:pt-6">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-[#5B4FE9] sm:min-h-0"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">Time</h1>
        <p className="mt-2 max-w-xl text-sm text-gray-500">
          How long do prospects spend in each stage on average? Where do they get stuck?
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-5 pt-6 pb-4 sm:px-6">
        {report.state === "error" && (
          <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
            Couldn&apos;t load stage timing right now. Try refreshing the page.
          </p>
        )}
        {report.state === "empty" && (
          <p className="rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
            No stage history yet — timing will show up once prospects start moving through the funnel.
          </p>
        )}
        {report.state === "ok" && (
          <div className="space-y-3">
            <DurationTable stages={report.stages} />
            <p className="px-1 text-xs text-gray-400">
              &ldquo;Ongoing&rdquo; prospects are still sitting in that stage right now, so they have no
              completed duration yet — they&apos;re excluded from the average rather than counted as 0 days.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

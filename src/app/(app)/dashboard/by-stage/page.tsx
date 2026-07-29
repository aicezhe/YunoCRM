import { getStageReport } from "./queries";
import { FunnelChart } from "./funnel-chart";

export default async function ByStagePage() {
  const report = await getStageReport();

  return (
    <>
      <div className="mx-auto max-w-5xl px-5 pt-6 sm:px-6 sm:pt-8">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">By stage</h1>
        <p className="mt-2 max-w-xl text-sm text-gray-500">
          How is the pipeline distributed across stages today?
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-5 pt-6 pb-4 sm:px-6">
        {report.state === "error" && (
          <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
            Couldn&apos;t load the pipeline breakdown right now. Try refreshing the page.
          </p>
        )}
        {report.state === "empty" && (
          <p className="rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
            No prospects yet — the funnel will fill in once some come in.
          </p>
        )}
        {report.state === "ok" && (
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)] sm:p-6">
            <p className="mb-4 text-sm text-gray-400">{report.total} prospects total</p>
            <FunnelChart stages={report.stages} />
          </div>
        )}
      </div>
    </>
  );
}

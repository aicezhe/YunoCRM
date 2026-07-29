import { BackToDashboard } from "../back-to-dashboard";
import { getSourceReport } from "./queries";
import { ChannelDonut } from "./channel-donut";
import { UtmDonut } from "./utm-donut";

function Header() {
  return (
    <div className="mx-auto max-w-5xl px-5 pt-4 sm:px-6 sm:pt-6">
      <BackToDashboard />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">Source</h1>
      <p className="mt-2 max-w-xl text-sm text-gray-500">
        Where do our prospects come from, and which channels convert best?
      </p>
    </div>
  );
}

export default async function SourcePage() {
  const report = await getSourceReport();

  return (
    <>
      <Header />
      <div className="mx-auto max-w-5xl px-5 pt-6 pb-4 sm:px-6">
        {report.state === "error" && (
          <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
            Couldn&apos;t load source data right now. Try refreshing the page.
          </p>
        )}
        {report.state === "empty" && (
          <p className="rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
            No prospects yet — once some come in, channel performance will show up here.
          </p>
        )}
        {report.state === "ok" && (
          <div className="space-y-8">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)] sm:p-8">
              <ChannelDonut channels={report.channels} />
            </div>

            {report.utm.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
                  Website — by UTM source
                </h2>
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)] sm:p-8">
                  <UtmDonut utm={report.utm} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

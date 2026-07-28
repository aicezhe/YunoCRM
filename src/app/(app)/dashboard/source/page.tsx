import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSourceReport, type ChannelRow } from "./queries";

const CHANNEL_LABELS: Record<string, string> = {
  website: "Website",
  linkedin_outbound: "LinkedIn outbound",
  referral: "Referral",
  event: "Events / trade fairs",
  content_inbound: "Content inbound",
};

function Header() {
  return (
    <div className="mx-auto max-w-5xl px-5 pt-4 sm:px-6 sm:pt-6">
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-[#5B4FE9] sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">Source</h1>
      <p className="mt-2 max-w-xl text-sm text-gray-500">
        Where do our prospects come from, and which channels convert best?
      </p>
    </div>
  );
}

function ChannelTable({ channels }: { channels: ChannelRow[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-medium tracking-wide text-gray-400 uppercase">
              <th className="px-5 py-4">Channel</th>
              <th className="px-5 py-4">Prospects</th>
              <th className="px-5 py-4">Active</th>
              <th className="px-5 py-4">Conversion to Won</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((row, i) => (
              <tr key={row.channel} className={i !== channels.length - 1 ? "border-b border-gray-50" : ""}>
                <td className="px-5 py-4 font-medium text-gray-900">
                  {CHANNEL_LABELS[row.channel] ?? row.channel}
                  {i === 0 && row.total > 0 && (
                    <span className="ml-2 rounded-full bg-[#5B4FE9]/10 px-2 py-0.5 text-xs font-semibold text-[#5B4FE9]">
                      Best
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-gray-600">{row.total}</td>
                <td className="px-5 py-4 text-gray-600">{row.active}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#5B4FE9]"
                        style={{ width: `${Math.min(row.conversionPct, 100)}%` }}
                      />
                    </div>
                    <span className="font-medium text-gray-900">{row.conversionPct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
            <ChannelTable channels={report.channels} />

            {report.utm.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
                  Website — by UTM source
                </h2>
                <div className="mt-3 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)]">
                  <ul className="divide-y divide-gray-50">
                    {report.utm.map((row) => (
                      <li key={row.utmSource} className="flex items-center justify-between px-5 py-3 text-sm">
                        <span className="text-gray-700">{row.utmSource}</span>
                        <span className="font-medium text-gray-900">{row.total}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

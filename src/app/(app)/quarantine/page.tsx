import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOpenQuarantineItems } from "./queries";
import { QuarantineClient } from "./quarantine-client";

function Header() {
  return (
    <div className="mx-auto max-w-3xl px-5 pt-4 sm:px-6 sm:pt-6">
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-[#5B4FE9] sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">Quarantine</h1>
      <p className="mt-2 max-w-xl text-sm text-gray-500">
        Raw events the automation pipeline couldn&apos;t confidently resolve on its own, waiting for a human call.
      </p>
    </div>
  );
}

export default async function QuarantinePage() {
  const report = await getOpenQuarantineItems();

  return (
    <>
      <Header />
      <div className="mx-auto max-w-3xl px-5 pt-6 pb-4 sm:px-6">
        {report.state === "error" && (
          <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
            Couldn&apos;t load the quarantine queue right now. Try refreshing the page.
          </p>
        )}
        {report.state === "empty" && <QuarantineClient initialItems={[]} />}
        {report.state === "ok" && <QuarantineClient initialItems={report.items} />}
      </div>
    </>
  );
}

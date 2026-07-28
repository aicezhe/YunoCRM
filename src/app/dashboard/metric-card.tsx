import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import type { Metric } from "./metrics";

const CARD_SHELL =
  "group relative flex flex-col rounded-3xl border border-white bg-white/80 p-7 " +
  "shadow-[0_8px_30px_-12px_rgba(91,79,233,0.20)] backdrop-blur-sm";

function MetricValue({ metric }: { metric: Metric }) {
  if (metric.state === "error") {
    return (
      <>
        <p className="text-3xl font-semibold tracking-tight text-gray-300">—</p>
        <p className="mt-1 text-sm text-red-500">Couldn&apos;t load this metric</p>
      </>
    );
  }

  if (metric.state === "empty") {
    return (
      <>
        <p className="text-4xl font-semibold tracking-tight text-gray-300">—</p>
        <p className="mt-1 text-sm text-gray-400">{metric.caption}</p>
      </>
    );
  }

  return (
    <>
      <p className="text-4xl font-semibold tracking-tight text-gray-900">{metric.value}</p>
      <p className="mt-1 text-sm text-gray-500">{metric.caption}</p>
    </>
  );
}

export function MetricCard({
  href,
  title,
  description,
  icon: Icon,
  metric,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  metric: Metric;
}) {
  return (
    <Link
      href={href}
      className={
        CARD_SHELL +
        " transition duration-200 hover:-translate-y-1 hover:border-[#5B4FE9]/20 " +
        "hover:shadow-[0_20px_45px_-15px_rgba(91,79,233,0.35)] " +
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5B4FE9]/20"
      }
    >
      <div className="flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5B4FE9]/10 text-[#5B4FE9]">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <ArrowUpRight
          className="h-5 w-5 text-gray-300 transition duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#5B4FE9]"
          strokeWidth={2}
        />
      </div>

      <div className="mt-6">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-sm text-gray-400">{description}</p>
      </div>

      <div className="mt-6">
        <MetricValue metric={metric} />
      </div>
    </Link>
  );
}

/** Shown while a card's metric query is still in flight (streamed via Suspense). */
export function MetricCardSkeleton({ title, description, icon: Icon }: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className={CARD_SHELL} aria-busy="true" aria-label={`Loading ${title}`}>
      <div className="flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5B4FE9]/10 text-[#5B4FE9]/40">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
      </div>

      <div className="mt-6">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-sm text-gray-400">{description}</p>
      </div>

      <div className="mt-6 animate-pulse">
        <div className="h-9 w-20 rounded-lg bg-gray-200/80" />
        <div className="mt-2 h-4 w-32 rounded bg-gray-100" />
      </div>
    </div>
  );
}

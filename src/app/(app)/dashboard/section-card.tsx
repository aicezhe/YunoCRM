import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * A dashboard section tile: a live stat (real number + short caption, not
 * a decorative icon) top-left, a delicate corner arrow, and the section
 * title bottom-right as a solid pill badge — clean geometry, uniform
 * radius, the site's normal sans-serif, no hand-drawn/organic styling.
 * Flat, lightly-tinted card background with a crisp border — the pill is
 * the only color accent.
 */
export function SectionCard({
  href,
  title,
  value,
  caption,
}: {
  href: string;
  title: string;
  value: string;
  caption: string;
}) {
  return (
    <Link
      href={href}
      className={
        "group relative flex min-h-44 flex-col justify-between rounded-[28px] border-2 border-[#5B4FE9]/12 bg-[#F8F6FF] p-7 sm:min-h-52 sm:p-8 " +
        "shadow-[0_16px_36px_-28px_rgba(91,79,233,0.4)] transition-all duration-300 ease-out " +
        "hover:-translate-y-0.5 hover:border-[#5B4FE9]/30 hover:shadow-[0_20px_44px_-24px_rgba(91,79,233,0.35)] " +
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5B4FE9]/20 " +
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-4xl font-bold tracking-tight text-[#5B4FE9] sm:text-5xl">{value}</p>
          <p className="mt-1.5 max-w-[12rem] text-xs font-medium text-gray-500">{caption}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#5B4FE9]/20 bg-white text-[#5B4FE9] transition duration-300 group-hover:bg-[#5B4FE9] group-hover:text-white">
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>

      <h2 className="self-end">
        <span className="inline-block rounded-xl bg-[#5B4FE9] px-4 py-1.5 text-xl font-bold tracking-wide text-white uppercase shadow-sm transition-colors duration-300 group-hover:bg-[#4B3FE0] sm:text-2xl">
          {title}
        </span>
      </h2>
    </Link>
  );
}

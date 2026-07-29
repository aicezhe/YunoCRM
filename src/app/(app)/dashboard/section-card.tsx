import Link from "next/link";

/**
 * A dashboard section tile: no icons or illustration — just a thin accent
 * rule, an uppercase label, and the live stat itself, set in generous
 * whitespace. The accent rule and label brighten to brand purple on hover;
 * everything else stays flat and typographic.
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
        "group relative flex min-h-40 flex-col gap-6 overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 sm:min-h-48 sm:p-7 " +
        "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[#5B4FE9]/25 hover:shadow-[0_20px_45px_-28px_rgba(91,79,233,0.35)] " +
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5B4FE9]/20 " +
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      }
    >
      <span
        aria-hidden
        className="absolute top-0 left-6 h-[3px] w-8 rounded-full bg-[#5B4FE9]/20 transition-all duration-300 group-hover:w-12 group-hover:bg-[#5B4FE9] sm:left-7"
      />

      <p className="pt-1 text-xs font-semibold tracking-[0.14em] text-gray-400 uppercase transition-colors duration-300 group-hover:text-[#5B4FE9]">
        {title}
      </p>

      <div className="mt-auto">
        <p className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{value}</p>
        <p className="mt-1.5 text-xs font-medium text-gray-500">{caption}</p>
      </div>
    </Link>
  );
}

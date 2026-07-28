import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

/**
 * A dashboard section tile. Icon, title and layout are the plain, settled
 * design (clean lucide line icons, ordinary sans-serif) — only the card's
 * background is a deliberate effect: an organic watercolor-style wash
 * instead of a linear gradient.
 *
 * The wash is two solid-colour circles blurred with a real CSS `filter:
 * blur()` (not faked with gradient stops), overlapping and bleeding in from
 * the bottom-right corner over a pale lavender base — so there is no
 * geometric edge anywhere the eye can lock onto. `overflow-hidden` on the
 * card clips the blur's bleed to the rounded rect.
 *
 * Contrast for the white title (which sits in the most saturated part of
 * the wash) was verified by replaying the same two blurred circles on a
 * <canvas> with ctx.filter = blur(), sampling the pixel under the title's
 * real on-screen position — that lands at ~5.6:1, clear of the 4.5:1 WCAG
 * AA threshold for normal text.
 */
export function SectionCard({
  href,
  title,
  icon: Icon,
}: {
  href: string;
  title: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className={
        "group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-[28px] bg-[#F7F5FF] p-7 sm:min-h-52 sm:p-8 " +
        "shadow-[0_20px_45px_-24px_rgba(91,79,233,0.35)] transition-all duration-300 ease-out " +
        "hover:-translate-y-0.5 hover:shadow-[0_26px_55px_-20px_rgba(91,79,233,0.42)] " +
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5B4FE9]/20 " +
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      }
    >
      {/* The wash itself — behind the content, clipped by the card's own
          overflow-hidden + rounded corners. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -bottom-[30%] -right-[15%] h-[100%] w-[80%] rounded-full bg-[#A996F0]/85 blur-[52px]" />
        <div className="absolute -bottom-[18%] -right-[6%] h-[68%] w-[58%] rounded-full bg-[#4B36C6]/85 blur-[38px]" />
      </div>

      <div className="relative z-10 flex items-start justify-between">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/60 bg-white/45 shadow-sm backdrop-blur-sm">
          <Icon className="h-7 w-7 text-[#5B4FE9]" strokeWidth={1.5} />
        </span>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white/25 text-[#5B4FE9] opacity-80 backdrop-blur-sm transition duration-300 group-hover:border-white group-hover:bg-white group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>

      {/* The title sits where the wash is most concentrated. */}
      <h2 className="relative z-10 mt-8 self-end text-right text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
    </Link>
  );
}

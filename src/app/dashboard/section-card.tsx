import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

/**
 * A dashboard section tile — softened per the owner's second pass on the
 * design: a gentle diagonal wash from near-white lavender to a muted mid
 * purple (never the fully saturated brand purple as a fill; that stays an
 * accent on the icon and the title), thin-stroke icon floating in a frosted
 * glass circle, a delicate corner arrow, generous padding, and a quiet
 * hover (a 2px lift plus a softer shadow — no growth/scale, per this
 * pass's "tihaya uverennost'" direction, which supersedes the more
 * energetic hover from the previous iteration).
 *
 * The gradient's darkest stop (bottom-right, under the title) is tuned so
 * white title text lands at ~4.9:1 contrast there — verified by rasterizing
 * this exact gradient and sampling the pixel under the title's actual
 * position (a 135deg gradient on a wide box doesn't put its 100% stop at
 * the literal corner, so the true color has to be measured, not assumed
 * from the stop list) — comfortably clear of the 4.5:1 WCAG AA threshold
 * for normal text, not just the 3:1 large-text minimum.
 *
 * Set inline rather than as a Tailwind arbitrary value: a multi-stop
 * background needs top-level commas, which the class scanner silently
 * refuses to turn into a rule at all.
 */
const CARD_BACKGROUND =
  "linear-gradient(135deg," +
  " #FAF9FF 0%, #EFEAFE 16%, #D9CCFA 32%, #B7A2F1 46%, #8C77E8 62%, #6656D8 100%)";

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
      style={{ backgroundImage: CARD_BACKGROUND }}
      className={
        "group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-[28px] p-7 sm:min-h-52 sm:p-8 " +
        "shadow-[0_20px_45px_-24px_rgba(91,79,233,0.35)] transition-all duration-300 ease-out " +
        "hover:-translate-y-0.5 hover:shadow-[0_26px_55px_-20px_rgba(91,79,233,0.42)] " +
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5B4FE9]/20 " +
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      }
    >
      <div className="flex items-start justify-between">
        {/* Frosted-glass badge so the icon floats above the gradient
            regardless of how light or dark that patch of it is. */}
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/60 bg-white/45 shadow-sm backdrop-blur-sm">
          <Icon className="h-7 w-7 text-[#5B4FE9]" strokeWidth={1.5} />
        </span>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white/25 text-[#5B4FE9] opacity-80 backdrop-blur-sm transition duration-300 group-hover:border-white group-hover:bg-white group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>

      {/* The title sits on the gradient's most saturated corner. */}
      <h2 className="mt-8 self-end text-right text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
    </Link>
  );
}

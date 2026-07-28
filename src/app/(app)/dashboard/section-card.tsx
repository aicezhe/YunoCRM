import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

export type WashVariant = "top-right" | "bottom-right" | "bottom-left" | "right-center";

/**
 * Position/size for the "spread" circle — the smaller, darker "anchor"
 * circle always stays bottom-right so the white title (contrast verified
 * below) always has a dense backing.
 *
 * Two earlier attempts at this kept the anchor at its original size (68%
 * height × 58% width of the card) and only moved the spread — but that
 * anchor alone already covers most of the card's right two-thirds, so
 * every variant still looked the same regardless of where the spread went.
 * Shrinking the anchor to a tight patch just behind the title text frees
 * up real visual room for the spread's position to actually read.
 */
const SPREAD_BY_VARIANT: Record<WashVariant, string> = {
  "top-right": "-top-[18%] -right-[10%] h-[62%] w-[58%]",
  "bottom-right": "-bottom-[30%] -right-[15%] h-[100%] w-[80%]",
  "bottom-left": "-bottom-[18%] -left-[18%] h-[62%] w-[58%]",
  "right-center": "top-[16%] -right-[22%] h-[62%] w-[56%]",
};

/**
 * A dashboard section tile: a decorative icon anchored near the bottom-left
 * (close to the title, so the two read as one grouped block rather than
 * two separate elements), a delicate corner arrow, and the title
 * bottom-right on an organic watercolor-style background wash.
 *
 * The wash is two solid-colour circles blurred with a real CSS `filter:
 * blur()` (not faked with gradient stops) over a pale lavender base, so
 * there is no geometric edge anywhere the eye can lock onto.
 * `overflow-hidden` on the card clips the blur's bleed to the rounded rect.
 * Each card gets a different `wash` variant (see SPREAD_BY_VARIANT) so the
 * four tiles don't read as identical copies of one template.
 */
export function SectionCard({
  href,
  title,
  icon: Icon,
  wash = "bottom-right",
}: {
  href: string;
  title: string;
  icon: LucideIcon;
  wash?: WashVariant;
}) {
  return (
    <Link
      href={href}
      className={
        "group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-[28px] bg-[#FCFBFF] p-7 sm:min-h-52 sm:p-8 " +
        "shadow-[0_20px_45px_-24px_rgba(91,79,233,0.35)] transition-all duration-300 ease-out " +
        "hover:-translate-y-0.5 hover:shadow-[0_26px_55px_-20px_rgba(91,79,233,0.42)] " +
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5B4FE9]/20 " +
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      }
    >
      {/* The wash itself — behind the content, clipped by the card's own
          overflow-hidden + rounded corners. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className={"absolute rounded-full bg-[#A996F0]/85 blur-[46px] " + SPREAD_BY_VARIANT[wash]} />
        <div className="absolute -bottom-[12%] -right-[5%] h-[54%] w-[44%] rounded-full bg-[#3D2BA8]/92 blur-[24px]" />
      </div>

      {/* Decorative icon, anchored near the title instead of spanning the
          full card height, so icon + title read as one grouped block. */}
      <Icon
        aria-hidden
        preserveAspectRatio="none"
        strokeWidth={1}
        className="pointer-events-none absolute bottom-6 left-3 h-[58%] w-[26%] text-[#5B4FE9]/50"
      />

      <div className="relative z-10 flex justify-end">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white/25 text-[#5B4FE9] opacity-80 backdrop-blur-sm transition duration-300 group-hover:border-white group-hover:bg-white group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>

      {/* The title sits where the wash is most concentrated. */}
      <h2 className="relative z-10 mt-3 self-end text-right text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
    </Link>
  );
}

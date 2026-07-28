import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

/**
 * A dashboard section tile, following the owner's sketch: the left side of
 * the card is white and washes out very gradually into saturated purple on
 * the right; a huge line-art icon fills the full height of the white zone,
 * its edge drifting a little into the gradient; the title sits bottom-right
 * on the purple zone and a circled arrow top-right. The card lifts and
 * grows on hover.
 *
 * The two background layers are set inline rather than as a Tailwind
 * arbitrary value — a multi-layer background needs top-level commas, which
 * the class scanner silently refuses to turn into a rule at all.
 */
const CARD_BACKGROUND = [
  // A long, eased white ramp: many closely-spaced stops so the blend into
  // purple stays soft the whole way across instead of breaking mid-card.
  "linear-gradient(97deg," +
    " #FFFFFF 0%, rgba(255,255,255,0.98) 16%, rgba(255,255,255,0.9) 28%," +
    " rgba(255,255,255,0.74) 40%, rgba(255,255,255,0.52) 52%," +
    " rgba(255,255,255,0.3) 63%, rgba(255,255,255,0.12) 73%, rgba(255,255,255,0) 84%)",
  "linear-gradient(105deg, #968FF3 0%, #6A5FF0 48%, #5B4FE9 72%, #4C3DD9 100%)",
].join(", ");

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
        "group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-3xl p-6 sm:min-h-52 sm:p-7 " +
        "shadow-[0_10px_30px_-12px_rgba(69,54,198,0.45)] transition duration-300 ease-out " +
        "hover:-translate-y-1 hover:scale-[1.035] hover:shadow-[0_28px_55px_-18px_rgba(69,54,198,0.6)] " +
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5B4FE9]/30 " +
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
      }
    >
      {/* Decorative oversized icon: full card height on the white zone, its
          right edge drifting into the gradient, arcs cropped by the card. */}
      <Icon
        aria-hidden
        strokeWidth={1.1}
        className="pointer-events-none absolute top-1/2 left-2 h-[112%] w-auto -translate-y-1/2 text-[#5B4FE9]/90"
      />

      <div className="relative flex justify-end">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 text-white transition duration-300 group-hover:border-white group-hover:bg-white group-hover:text-[#5B4FE9]">
          <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>

      {/* The title lives on the purple end, bottom-right, as sketched. */}
      <h2 className="relative mt-8 self-end text-right text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
    </Link>
  );
}

import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

/**
 * A dashboard section tile, following the owner's sketch: white on the left
 * blending horizontally into saturated purple on the right, the icon drawn
 * in purple on the white zone, the title in white over the purple zone, and
 * a circled arrow top-right. The card lifts and grows on hover.
 *
 * Two stacked layers: a purple base and a white wash fading out toward the
 * right. Set inline rather than as a Tailwind arbitrary value — a
 * multi-layer background needs top-level commas, which the class scanner
 * silently refuses to turn into a rule at all.
 */
const CARD_BACKGROUND = [
  "linear-gradient(97deg, #FFFFFF 0%, rgba(255,255,255,0.92) 24%, rgba(255,255,255,0.45) 42%, rgba(255,255,255,0) 62%)",
  "linear-gradient(105deg, #8A82F2 0%, #6A5FF0 45%, #5B4FE9 70%, #4C3DD9 100%)",
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
      <div className="flex items-start justify-between">
        {/* The icon sits on the white end of the gradient, so it is purple. */}
        <Icon className="h-10 w-10 text-[#5B4FE9] sm:h-11 sm:w-11" strokeWidth={1.5} />
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 text-white transition duration-300 group-hover:border-white group-hover:bg-white group-hover:text-[#5B4FE9]">
          <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>

      {/* The title lives on the purple end, bottom-right, as sketched. */}
      <h2 className="mt-8 self-end text-right text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
    </Link>
  );
}

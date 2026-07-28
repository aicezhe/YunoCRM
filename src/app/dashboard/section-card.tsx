import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

/**
 * A dashboard section tile: purple gradient, oversized icon, large title and
 * a circled arrow, lifting and growing on hover.
 *
 * The white bloom in the top-left corner is a radial layer over the diagonal
 * gradient — that soft white-into-purple blend is what makes the card read as
 * Yuno's rather than a flat brand-colour block. It is set inline rather than
 * as a Tailwind arbitrary value: a two-layer background needs top-level
 * commas, which the class scanner does not parse (it silently emits no rule
 * at all, leaving white-on-white).
 */
const CARD_BACKGROUND = [
  "radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 46%)",
  "linear-gradient(135deg, #6E62EE 0%, #5B4FE9 45%, #4536C6 100%)",
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
        <Icon className="h-10 w-10 text-white/85 sm:h-11 sm:w-11" strokeWidth={1.5} />
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/45 text-white transition duration-300 group-hover:border-white group-hover:bg-white group-hover:text-[#5B4FE9]">
          <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>

      <h2 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
    </Link>
  );
}

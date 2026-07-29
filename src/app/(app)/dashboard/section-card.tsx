import Link from "next/link";

export type Motif = "source" | "stage" | "time" | "withering";

/** Per-section geometric animation, drawn in currentColor so the wrapper
 * controls the tint (and can brighten it on hover). Strictly geometric —
 * rings, bars, lines — to stay in the site's clean style. */
function MotifArt({ motif }: { motif: Motif }) {
  if (motif === "source") {
    // Channels orbiting a center: concentric rings + three orbiting dots.
    return (
      <svg viewBox="0 0 96 96" fill="none" className="h-full w-full" aria-hidden>
        <circle cx="48" cy="48" r="34" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
        <circle cx="48" cy="48" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <circle cx="48" cy="48" r="5" fill="currentColor" />
        <g className="motif-orbit">
          <circle cx="48" cy="14" r="4" fill="currentColor" />
          <circle cx="77.4" cy="65" r="3" fill="currentColor" opacity="0.7" />
          <circle cx="18.6" cy="65" r="3.5" fill="currentColor" opacity="0.85" />
        </g>
      </svg>
    );
  }
  if (motif === "stage") {
    // Funnel stages: ascending bars breathing in sequence.
    return (
      <svg viewBox="0 0 96 96" fill="none" className="h-full w-full" aria-hidden>
        <rect x="14" y="56" width="11" height="24" rx="5.5" fill="currentColor" opacity="0.45" className="motif-grow" />
        <rect x="33" y="44" width="11" height="36" rx="5.5" fill="currentColor" opacity="0.6" className="motif-grow" style={{ animationDelay: "0.25s" }} />
        <rect x="52" y="32" width="11" height="48" rx="5.5" fill="currentColor" opacity="0.8" className="motif-grow" style={{ animationDelay: "0.5s" }} />
        <rect x="71" y="20" width="11" height="60" rx="5.5" fill="currentColor" className="motif-grow" style={{ animationDelay: "0.75s" }} />
      </svg>
    );
  }
  if (motif === "time") {
    // A clock: ring, quarter ticks, sweeping hand.
    return (
      <svg viewBox="0 0 96 96" fill="none" className="h-full w-full" aria-hidden>
        <circle cx="48" cy="48" r="34" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <line x1="48" y1="14" x2="48" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <line x1="48" y1="76" x2="48" y2="82" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <line x1="14" y1="48" x2="20" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <line x1="76" y1="48" x2="82" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <g className="motif-sweep">
          <line x1="48" y1="48" x2="48" y2="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <circle cx="48" cy="48" r="4" fill="currentColor" />
      </svg>
    );
  }
  // withering: a declining curve with dots dropping off its tail.
  return (
    <svg viewBox="0 0 96 96" fill="none" className="h-full w-full" aria-hidden>
      <path d="M12 30 C 34 34, 52 46, 82 72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle cx="12" cy="30" r="4" fill="currentColor" opacity="0.7" />
      <circle cx="82" cy="72" r="4.5" fill="currentColor" className="motif-pulse" />
      <circle cx="52" cy="52" r="3" fill="currentColor" className="motif-fall" />
      <circle cx="67" cy="64" r="2.5" fill="currentColor" className="motif-fall" style={{ animationDelay: "1.5s" }} />
    </svg>
  );
}

/**
 * A dashboard section tile: thin accent rule, uppercase label, the live
 * stat, and a per-section animated geometric motif on the right — rings,
 * bars, lines in brand purple, no illustrations. The rule, label, and
 * motif all brighten on hover.
 */
export function SectionCard({
  href,
  title,
  value,
  caption,
  motif,
}: {
  href: string;
  title: string;
  value: string;
  caption: string;
  motif: Motif;
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

      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-5 h-20 w-20 -translate-y-1/2 text-[#5B4FE9]/30 transition-colors duration-300 group-hover:text-[#5B4FE9]/60 sm:right-7 sm:h-24 sm:w-24"
      >
        <MotifArt motif={motif} />
      </span>

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

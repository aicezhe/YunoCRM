"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { avgDaysKey } from "@/i18n/format-days";
import type { StageDuration } from "./queries";

// Same reveal budget as the other lists: the grid cascades but finishes fast.
const REVEAL_BUDGET_S = 0.4;

const CARD_H = "h-[168px]";
const FACE = "absolute inset-0 flex flex-col justify-between rounded-3xl border p-5 [backface-visibility:hidden]";

function StageCard({ row, longest, delay }: { row: StageDuration; longest: number; delay: number }) {
  const t = useTranslations("timeScreen");
  const tStage = useTranslations("stages");
  const locale = useLocale();
  const [flipped, setFlipped] = useState(false);

  const isBottleneck = row.avgDays !== null && row.avgDays === longest && longest > 0;
  const fillPct = row.avgDays !== null && longest > 0 ? (row.avgDays / longest) * 100 : 0;
  const avgLabel = row.avgDays !== null ? t(avgDaysKey(row.avgDays, locale), { count: row.avgDays }) : "–";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26, delay }}
      // Perspective lives on the wrapper, not the rotating element: on the
      // element itself the rotation would be a flat skew with no depth.
      style={{ perspective: 1200 }}
    >
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
        aria-label={flipped ? t("flipToAverage", { stage: tStage(row.stage) }) : t("flipToCounts", { stage: tStage(row.stage) })}
        className={`group relative w-full cursor-pointer text-left ${CARD_H} rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-[#5B4FE9]/20`}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Front: the headline number */}
          <div
            aria-hidden={flipped}
            className={
              FACE +
              " shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)] transition-shadow group-hover:shadow-[0_24px_50px_-28px_rgba(91,79,233,0.45)] " +
              (isBottleneck ? "border-red-100 bg-red-50/40" : "border-gray-100 bg-white")
            }
          >
            {/* min-w-0 lets a long stage name wrap instead of shoving the
                badge off the card — "Дольше всего" next to "ДЕМО ПРОВЕДЕНО"
                is the tightest case across the three locales. */}
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-xs font-medium tracking-wide text-gray-400 uppercase">
                {tStage(row.stage)}
              </span>
              {isBottleneck && (
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] leading-tight font-semibold text-red-700">
                  {t("slowest")}
                </span>
              )}
            </div>

            <div>
              <p
                className={
                  "text-2xl leading-tight font-semibold sm:text-3xl " +
                  (isBottleneck ? "text-red-600" : "text-gray-900")
                }
              >
                {avgLabel}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">{t("colAvgDays")}</p>
            </div>

            {/* Length relative to the slowest stage, so the cards compare at a
                glance without re-reading every number. Right padding keeps it
                clear of the flip affordance in the corner. */}
            <div className="mr-6 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fillPct}%` }}
                transition={{ type: "spring", stiffness: 80, damping: 18, delay: delay + 0.1 }}
                className={"h-full rounded-full " + (isBottleneck ? "bg-red-400" : "bg-[#5B4FE9]")}
              />
            </div>
          </div>

          {/* Back: the current backlog. The front's average only describes
              prospects who DID move on — the stuck ones are excluded from it
              by construction, so the back is where "where do they get stuck"
              is actually answered: how many are sitting here now, and for
              how long already. */}
          <div
            aria-hidden={!flipped}
            className={FACE + " border-[#4B3FE0] bg-[#5B4FE9] text-white shadow-[0_20px_45px_-30px_rgba(91,79,233,0.6)]"}
            style={{ transform: "rotateY(180deg)" }}
          >
            <span className="text-xs font-medium tracking-wide text-white/60 uppercase">{tStage(row.stage)}</span>

            <dl className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-white/60">{t("colCompleted")}</dt>
                <dd className="text-sm font-semibold tabular-nums">{row.completed}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-white/60">{t("colOngoing")}</dt>
                <dd className="text-sm font-semibold tabular-nums">{row.ongoing}</dd>
              </div>
              {row.ongoingAvgDays !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-white/60">{t("ongoingWaitAvg")}</dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {t(avgDaysKey(row.ongoingAvgDays, locale), { count: row.ongoingAvgDays })}
                  </dd>
                </div>
              )}
              {row.ongoingMaxDays !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-white/60">{t("ongoingWaitMax")}</dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {t(avgDaysKey(row.ongoingMaxDays, locale), { count: row.ongoingMaxDays })}
                  </dd>
                </div>
              )}
            </dl>

            {row.ongoing === 0 ? (
              <p className="text-[11px] leading-snug text-white/50">{t("backEmpty")}</p>
            ) : (
              <p className="text-[11px] leading-snug text-white/50">{t("backNote")}</p>
            )}
          </div>
        </motion.div>

        {/* Sits outside the rotating element so it never mirrors. */}
        <span className="pointer-events-none absolute right-4 bottom-4 text-gray-300 transition group-hover:text-gray-400">
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </button>
    </motion.div>
  );
}

/**
 * The stage timings as flip cards rather than a table row per stage: the
 * average is the answer to the screen's question, and the two counts behind
 * it are the "how was that computed" follow-up — which is exactly a back
 * side. Also removes the horizontal scroll the 4-column table needed on a
 * phone.
 */
export function StageCards({ stages }: { stages: StageDuration[] }) {
  const longest = Math.max(0, ...stages.map((s) => s.avgDays ?? 0));
  const step = REVEAL_BUDGET_S / Math.max(stages.length, 1);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stages.map((row, i) => (
        <StageCard key={row.stage} row={row} longest={longest} delay={i * step} />
      ))}
    </div>
  );
}

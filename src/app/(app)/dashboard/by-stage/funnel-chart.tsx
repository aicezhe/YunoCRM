"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { StageRow } from "./queries";

// Won/Lost are outcomes, not steps — they get their own colors and are set
// apart from the funnel proper by a divider.
const BAR_GRADIENT: Record<string, string> = {
  Won: "linear-gradient(90deg, #22C55E, #4ADE80)",
  Lost: "linear-gradient(90deg, #9CA3AF, #C7CBD1)",
};
const DEFAULT_GRADIENT = "linear-gradient(90deg, #5B4FE9, #8B7FF7)";
const FIRST_TERMINAL = "Won";

// One reveal budget for the whole list (same idea as the /search grid): the
// rows cascade, but the last one still lands inside half a second.
const REVEAL_BUDGET_S = 0.45;

function StageBar({ row, maxCount, delay }: { row: StageRow; maxCount: number; delay: number }) {
  const tStage = useTranslations("stages");
  const widthPct = maxCount === 0 ? 0 : (row.count / maxCount) * 100;
  const isEmpty = row.count === 0;

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <span
        className={
          "w-24 shrink-0 text-right text-[13px] leading-tight sm:w-32 sm:text-sm " +
          (isEmpty ? "text-gray-300" : "text-gray-600")
        }
      >
        {tStage(row.stage)}
      </span>

      {/* The track is the 100% reference — the busiest stage fills it — so
          the bars read against each other. The share of ALL prospects is the
          printed percentage, not the bar length. */}
      <div className="relative h-5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#F4F2FD]">
        {!isEmpty && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${widthPct}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 18, delay }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: BAR_GRADIENT[row.stage] ?? DEFAULT_GRADIENT }}
          />
        )}
      </div>

      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.15, duration: 0.25 }}
        className="w-16 shrink-0 text-right text-sm tabular-nums sm:w-20"
      >
        <span className={isEmpty ? "font-medium text-gray-300" : "font-semibold text-gray-900"}>{row.count}</span>{" "}
        <span className={"text-xs " + (isEmpty ? "text-gray-200" : "text-gray-400")}>{row.pct}%</span>
      </motion.span>
    </div>
  );
}

/**
 * Hand-built stage bars instead of a recharts <BarChart>: the counts are the
 * content here, and a chart that hides them behind a hover tooltip loses them
 * entirely on touch. Every row shows its count and share at rest; the bars
 * scale against the busiest stage and cascade in on load. The stage enum
 * value is only ever passed to the translator, never altered.
 */
export function FunnelChart({ stages }: { stages: StageRow[] }) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const step = REVEAL_BUDGET_S / Math.max(stages.length, 1);
  const firstTerminal = stages.findIndex((s) => s.stage === FIRST_TERMINAL);

  return (
    <div className="space-y-3.5 py-2">
      {stages.map((row, i) => (
        <div key={row.stage}>
          {i === firstTerminal && <div className="mb-3.5 border-t border-dashed border-gray-200" />}
          <StageBar row={row} maxCount={maxCount} delay={i * step} />
        </div>
      ))}
    </div>
  );
}

/** Pill classes for a funnel stage: terminal stages get their own color,
 * everything in progress shares the brand tint. Used by the company page,
 * the search cards and the search overlay — one map, so a stage cannot be
 * green on one screen and purple on another. */
const STAGE_COLORS: Record<string, string> = {
  Won: "bg-green-100 text-green-700",
  Lost: "bg-gray-200 text-gray-600",
};

export function stageColor(stage: string): string {
  return STAGE_COLORS[stage] ?? "bg-[#5B4FE9]/10 text-[#5B4FE9]";
}

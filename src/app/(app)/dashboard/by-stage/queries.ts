import { sql } from "drizzle-orm";
import { db } from "@/db";

export type StageRow = {
  stage: string;
  count: number;
  pct: number;
};

export type StageReport = { state: "ok"; stages: StageRow[]; total: number } | { state: "empty" } | { state: "error" };

/** funnel_stage enum order, used both for the query and the chart's y-axis. */
export const FUNNEL_STAGES = [
  "Lead",
  "Contacted",
  "Demo Scheduled",
  "Demo Done",
  "Trial",
  "Negotiation",
  "Won",
  "Lost",
] as const;

export async function getStageReport(): Promise<StageReport> {
  try {
    const rows = await db.execute<{ current_stage: string; count: number }>(sql`
      select current_stage::text, count(*)::int as count
      from prospects
      group by current_stage
    `);

    const total = rows.reduce((sum, r) => sum + r.count, 0);
    if (total === 0) return { state: "empty" };

    const byStage = new Map(rows.map((r) => [r.current_stage, r.count]));
    const stages: StageRow[] = FUNNEL_STAGES.map((stage) => {
      const count = byStage.get(stage) ?? 0;
      return { stage, count, pct: Math.round((count / total) * 1000) / 10 };
    });

    return { state: "ok", stages, total };
  } catch (err) {
    console.error("[dashboard/by-stage] query failed:", err);
    return { state: "error" };
  }
}

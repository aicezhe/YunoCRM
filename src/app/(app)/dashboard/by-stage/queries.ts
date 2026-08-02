import { sql } from "drizzle-orm";
import { db } from "@/db";

export type StageRow = {
  stage: string;
  count: number;
  pct: number;
};

export type LostRow = {
  companyId: string;
  companyName: string;
  channel: string;
  /** Non-null in practice: the lost_requires_reason CHECK makes a Lost
   * prospect without a reason unrepresentable. Typed nullable only because
   * the column is. */
  reason: string | null;
};

export type StageReport =
  | { state: "ok"; stages: StageRow[]; total: number; lost: LostRow[] }
  | { state: "empty" }
  | { state: "error" };

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

    // The brief's requirement is not just that Lost carries a reason, but
    // that the reason is visible — so the screen lists every lost prospect
    // with its why, not only the bar.
    const lostRows = await db.execute<{
      company_id: string;
      company_name: string;
      channel: string;
      reason: string | null;
    }>(sql`
      select c.id as company_id, c.name as company_name,
             p.channel::text as channel, p.lost_reason as reason
      from prospects p
      join companies c on c.id = p.company_id
      where p.current_stage = 'Lost'
      order by c.name asc
    `);

    return {
      state: "ok",
      stages,
      total,
      lost: lostRows.map((r) => ({
        companyId: r.company_id,
        companyName: r.company_name,
        channel: r.channel,
        reason: r.reason,
      })),
    };
  } catch (err) {
    console.error("[dashboard/by-stage] query failed:", err);
    return { state: "error" };
  }
}

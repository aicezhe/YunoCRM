import { sql } from "drizzle-orm";
import { db } from "@/db";

export type StageDuration = {
  stage: string;
  avgDays: number | null;
  completed: number;
  ongoing: number;
};

export type TimeReport = { state: "ok"; stages: StageDuration[] } | { state: "empty" } | { state: "error" };

/**
 * Only non-terminal stages are shown: Won/Lost are outcomes, not stages a
 * prospect "moves on" from, so "average time before moving on" doesn't apply
 * to them (every transition into Won/Lost is, by definition, the last one).
 */
const NON_TERMINAL_STAGES = ["Lead", "Contacted", "Demo Scheduled", "Demo Done", "Trial", "Negotiation"] as const;

/**
 * A prospect's time in `to_stage` is the gap between entering it
 * (stage_transitions.occurred_at) and its next transition. The row with no
 * next transition is the prospect's *current* stage — it hasn't "moved on"
 * yet, so it's excluded from the average and counted separately as
 * "ongoing" rather than silently dropped or treated as zero days.
 */
export async function getTimeReport(): Promise<TimeReport> {
  try {
    const rows = await db.execute<{ stage: string; avg_days: string | null; completed: number; ongoing: number }>(
      sql`
        with spans as (
          select
            to_stage,
            occurred_at,
            lead(occurred_at) over (partition by prospect_id order by occurred_at) as next_at
          from stage_transitions
        )
        select
          to_stage::text as stage,
          round(avg(extract(epoch from (next_at - occurred_at)) / 86400) filter (where next_at is not null)::numeric, 1) as avg_days,
          count(*) filter (where next_at is not null)::int as completed,
          count(*) filter (where next_at is null)::int as ongoing
        from spans
        group by to_stage
      `
    );

    if (rows.length === 0) return { state: "empty" };

    const byStage = new Map(rows.map((r) => [r.stage, r]));
    const stages: StageDuration[] = NON_TERMINAL_STAGES.map((stage) => {
      const row = byStage.get(stage);
      return {
        stage,
        avgDays: row?.avg_days != null ? Number(row.avg_days) : null,
        completed: row?.completed ?? 0,
        ongoing: row?.ongoing ?? 0,
      };
    }).sort((a, b) => (b.avgDays ?? -1) - (a.avgDays ?? -1));

    if (stages.every((s) => s.completed === 0 && s.ongoing === 0)) return { state: "empty" };

    return { state: "ok", stages };
  } catch (err) {
    console.error("[dashboard/time] query failed:", err);
    return { state: "error" };
  }
}

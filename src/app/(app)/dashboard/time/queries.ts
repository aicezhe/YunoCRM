import { sql } from "drizzle-orm";
import { db } from "@/db";

export type StageDuration = {
  stage: string;
  /** Throughput: how long prospects who DID move on spent here. */
  avgDays: number | null;
  completed: number;
  /** Backlog: prospects sitting in this stage right now... */
  ongoing: number;
  /** ...and how long they have been waiting, from entering the stage to the
   * dataset's newest event. This answers "where do they get stuck" — the
   * average above can't, because the stuck are by definition not in it
   * (survivorship bias: a stage everyone clears in a day but 35 prospects
   * rot in shows a flattering 1.1d). */
  ongoingAvgDays: number | null;
  ongoingMaxDays: number | null;
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
 *
 * The window orders by (occurred_at, to_stage), not occurred_at alone. One
 * inbound email can produce two transitions sharing a timestamp — a website
 * lead that is created and contacted at once yields `→ Lead` and
 * `Lead → Contacted` at the same instant, which happens for 39 prospects in
 * the seeded data. Ordering by the timestamp alone leaves those ties in an
 * arbitrary order, so whichever stage got sorted second would absorb the
 * *next* stage's duration, and the averages would shift between runs.
 * funnel_stage is a Postgres enum, so `to_stage` sorts in declared funnel
 * order and reconstructs the intended chain: Lead lasted 0 days here, which
 * is the truth.
 */
export async function getTimeReport(): Promise<TimeReport> {
  try {
    const rows = await db.execute<{
      stage: string;
      avg_days: string | null;
      completed: number;
      ongoing: number;
      ongoing_avg_days: string | null;
      ongoing_max_days: string | null;
    }>(
      sql`
        with as_of as (
          -- Same anchor as the Withering screen: the dataset's newest event,
          -- not the wall clock, or a non-live fixture inflates every wait.
          select max(occurred_at) as at from interactions
        ),
        spans as (
          select
            to_stage,
            occurred_at,
            lead(occurred_at) over (partition by prospect_id order by occurred_at, to_stage) as next_at
          from stage_transitions
        )
        select
          to_stage::text as stage,
          round(avg(extract(epoch from (next_at - occurred_at)) / 86400) filter (where next_at is not null)::numeric, 1) as avg_days,
          count(*) filter (where next_at is not null)::int as completed,
          count(*) filter (where next_at is null)::int as ongoing,
          round(avg(extract(epoch from ((select at from as_of) - occurred_at)) / 86400) filter (where next_at is null)::numeric, 1) as ongoing_avg_days,
          round(max(extract(epoch from ((select at from as_of) - occurred_at)) / 86400) filter (where next_at is null)::numeric, 1) as ongoing_max_days
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
        ongoingAvgDays: row?.ongoing_avg_days != null ? Number(row.ongoing_avg_days) : null,
        ongoingMaxDays: row?.ongoing_max_days != null ? Number(row.ongoing_max_days) : null,
      };
    }).sort((a, b) => (b.avgDays ?? -1) - (a.avgDays ?? -1));

    if (stages.every((s) => s.completed === 0 && s.ongoing === 0)) return { state: "empty" };

    return { state: "ok", stages };
  } catch (err) {
    console.error("[dashboard/time] query failed:", err);
    return { state: "error" };
  }
}

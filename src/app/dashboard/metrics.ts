import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Preview metrics for the dashboard cards. Each function owns one card's
 * single headline number and never throws — it resolves to a discriminated
 * union so the card can render an ok / empty / error state without an
 * error boundary swallowing the whole page.
 */
export type Metric =
  | { state: "ok"; value: string; caption: string }
  | { state: "empty"; caption: string }
  | { state: "error" };

/** DECISIONS.md §8: a prospect is "cold" after this long with no interaction. */
export const COLD_THRESHOLD_DAYS = 14;

function failed(card: string, err: unknown): Metric {
  console.error(`[dashboard] ${card} metric failed:`, err);
  return { state: "error" };
}

/**
 * "Cold" is measured against the newest interaction in the database, not the
 * wall clock. The seeded dataset ends 2026-07-09, so a wall-clock reference
 * would mark every prospect stale and make the number meaningless. Once live
 * ingestion is running, the newest interaction IS ~now and this reads the
 * same — see the same reasoning in scripts/resolve.ts.
 */
export async function getDataAsOf(): Promise<Date | null> {
  try {
    const rows = await db.execute<{ as_of: Date | null }>(
      sql`select max(occurred_at) as as_of from interactions`
    );
    return rows[0]?.as_of ?? null;
  } catch (err) {
    console.error("[dashboard] as-of date lookup failed:", err);
    return null;
  }
}

/** Source — how many prospects exist, and how many channels brought them in. */
export async function getSourceMetric(): Promise<Metric> {
  try {
    const rows = await db.execute<{ total: number; channels: number }>(sql`
      select count(*)::int as total, count(distinct channel)::int as channels
      from prospects
    `);
    const { total = 0, channels = 0 } = rows[0] ?? {};
    if (total === 0) return { state: "empty", caption: "no prospects yet" };
    return {
      state: "ok",
      value: String(total),
      caption: `across ${channels} ${channels === 1 ? "channel" : "channels"}`,
    };
  } catch (err) {
    return failed("source", err);
  }
}

/** By stage — how many prospects are still open (neither Won nor Lost). */
export async function getStageMetric(): Promise<Metric> {
  try {
    const rows = await db.execute<{ active: number; total: number }>(sql`
      select
        count(*) filter (where current_stage not in ('Won', 'Lost'))::int as active,
        count(*)::int as total
      from prospects
    `);
    const { active = 0, total = 0 } = rows[0] ?? {};
    if (total === 0) return { state: "empty", caption: "no prospects yet" };
    return { state: "ok", value: String(active), caption: "open in the pipeline" };
  } catch (err) {
    return failed("by stage", err);
  }
}

/**
 * Time — average days a prospect spends in a stage before moving on.
 * Measured from consecutive stage_transitions per prospect; the final
 * (current) stage has no end yet and is excluded.
 */
export async function getTimeMetric(): Promise<Metric> {
  try {
    const rows = await db.execute<{ avg_days: string | null }>(sql`
      select round(avg(extract(epoch from (next_at - occurred_at)) / 86400)::numeric, 1) as avg_days
      from (
        select
          occurred_at,
          lead(occurred_at) over (partition by prospect_id order by occurred_at) as next_at
        from stage_transitions
      ) spans
      where next_at is not null
    `);
    const avgDays = rows[0]?.avg_days;
    if (avgDays === null || avgDays === undefined) {
      return { state: "empty", caption: "no stage history yet" };
    }
    return { state: "ok", value: String(avgDays), caption: "avg days per stage" };
  } catch (err) {
    return failed("time", err);
  }
}

/** Withering — open prospects with no interaction for COLD_THRESHOLD_DAYS. */
export async function getWitheringMetric(): Promise<Metric> {
  try {
    const rows = await db.execute<{ cold: number; active: number }>(sql`
      select
        count(*) filter (
          where last_interaction_at is null
             or last_interaction_at < (select max(occurred_at) from interactions)
                                      - make_interval(days => ${COLD_THRESHOLD_DAYS})
        )::int as cold,
        count(*)::int as active
      from prospects
      where current_stage not in ('Won', 'Lost')
    `);
    const { cold = 0, active = 0 } = rows[0] ?? {};
    if (active === 0) return { state: "empty", caption: "no open prospects" };
    return {
      state: "ok",
      value: String(cold),
      caption: `of ${active} open, cold ${COLD_THRESHOLD_DAYS}+ days`,
    };
  } catch (err) {
    return failed("withering", err);
  }
}

import { sql } from "drizzle-orm";
import { db } from "@/db";

/** DECISIONS.md: a prospect is "cold" after this long with no interaction. */
export const COLD_THRESHOLD_DAYS = 14;

export type WitheringRow = {
  prospectId: string;
  companyId: string;
  companyName: string;
  currentStage: string;
  ownerName: string | null;
  channel: string;
  daysCold: number;
};

export type WitheringReport = { state: "ok"; rows: WitheringRow[] } | { state: "empty" } | { state: "error" };

/**
 * "Cold" is measured against the newest interaction in the whole dataset,
 * not the wall clock — the seed data ends mid-2026, so a wall-clock
 * reference would mark every prospect stale. Same reasoning as
 * dashboard/metrics.ts and scripts/resolve.ts.
 */
export async function getWitheringReport(): Promise<WitheringReport> {
  try {
    const rows = await db.execute<{
      prospect_id: string;
      company_id: string;
      company_name: string;
      current_stage: string;
      owner_name: string | null;
      channel: string;
      days_cold: string;
    }>(sql`
      with as_of as (select max(occurred_at) as at from interactions)
      select
        p.id as prospect_id,
        c.id as company_id,
        c.name as company_name,
        p.current_stage::text as current_stage,
        u.name as owner_name,
        p.channel::text as channel,
        round(extract(epoch from ((select at from as_of) - coalesce(p.last_interaction_at, '-infinity'))) / 86400, 1) as days_cold
      from prospects p
      join companies c on c.id = p.company_id
      left join users u on u.id = p.owner_id
      where p.current_stage not in ('Won', 'Lost')
        and (
          p.last_interaction_at is null
          or p.last_interaction_at < (select at from as_of) - make_interval(days => ${COLD_THRESHOLD_DAYS})
        )
      order by days_cold desc
    `);

    if (rows.length === 0) return { state: "empty" };

    return {
      state: "ok",
      rows: rows.map((r) => ({
        prospectId: r.prospect_id,
        companyId: r.company_id,
        companyName: r.company_name,
        currentStage: r.current_stage,
        ownerName: r.owner_name,
        channel: r.channel,
        daysCold: Number(r.days_cold),
      })),
    };
  } catch (err) {
    console.error("[dashboard/withering] query failed:", err);
    return { state: "error" };
  }
}

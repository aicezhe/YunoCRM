import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Pipeline metrics, one function per dashboard section.
 *
 * The home screen's cards are navigation tiles and no longer show a number,
 * so only getDataAsOf() is called from there today — the rest are kept for
 * the section screens (/dashboard/source, /by-stage, /time, /withering),
 * which are built next.
 *
 * No function throws: each resolves to a discriminated union so a caller can
 * render an ok / empty / error state without one failed query taking down
 * the whole page.
 */
/**
 * Captions are returned as a translation key plus its parameters, not as a
 * finished string: these run on the server, where the caption's plural form
 * depends on the viewer's locale (Russian needs three forms for "channel").
 * The page resolves them through next-intl, so ICU does the plural work.
 */
export type Metric =
  | { state: "ok"; value: string; captionKey: string; captionParams?: Record<string, number> }
  | { state: "empty"; captionKey: string }
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
    if (total === 0) return { state: "empty", captionKey: "sourceEmpty" };
    return {
      state: "ok",
      value: String(total),
      captionKey: "sourceCaption",
      captionParams: { count: channels },
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
    if (total === 0) return { state: "empty", captionKey: "stageEmpty" };
    return { state: "ok", value: String(active), captionKey: "stageCaption" };
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
          lead(occurred_at) over (partition by prospect_id order by occurred_at, to_stage) as next_at
        from stage_transitions
      ) spans
      where next_at is not null
    `);
    const avgDays = rows[0]?.avg_days;
    if (avgDays === null || avgDays === undefined) {
      return { state: "empty", captionKey: "timeEmpty" };
    }
    return { state: "ok", value: String(avgDays), captionKey: "timeCaption" };
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
    if (active === 0) return { state: "empty", captionKey: "witheringEmpty" };
    return {
      state: "ok",
      value: String(cold),
      captionKey: "witheringCaption",
      captionParams: { active, days: COLD_THRESHOLD_DAYS },
    };
  } catch (err) {
    return failed("withering", err);
  }
}

export type ActivityItem = {
  id: string;
  companyName: string;
  type: string;
  direction: string | null;
  occurredAt: string;
};

export type ActivityReport = { state: "ok"; items: ActivityItem[] } | { state: "empty" } | { state: "error" };

/** Recent activity — the newest few interactions across every prospect, for
 * the home screen's "the CRM is alive" strip below the section cards. */
export async function getRecentActivity(limit = 5): Promise<ActivityReport> {
  try {
    const rows = await db.execute<{
      id: string;
      company_name: string;
      type: string;
      direction: string | null;
      occurred_at: string;
    }>(sql`
      select i.id, c.name as company_name, i.type::text as type, i.direction::text as direction, i.occurred_at
      from interactions i
      join prospects p on p.id = i.prospect_id
      join companies c on c.id = p.company_id
      order by i.occurred_at desc
      limit ${limit}
    `);

    if (rows.length === 0) return { state: "empty" };
    return {
      state: "ok",
      items: rows.map((r) => ({
        id: r.id,
        companyName: r.company_name,
        type: r.type,
        direction: r.direction,
        occurredAt: r.occurred_at,
      })),
    };
  } catch (err) {
    console.error("[dashboard] recent activity query failed:", err);
    return { state: "error" };
  }
}

import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";

/**
 * Which slice of the Source screen was clicked. `utm` always implies
 * channel = 'website' (that donut only breaks down website prospects), and
 * carries the RAW utm_source — `null` is the real "not set" bucket, not the
 * "(not set)" label shown in the UI. Comparing against the label instead
 * would silently match nothing.
 */
export type Segment =
  | { kind: "channel"; channel: string }
  | { kind: "utm"; utmSource: string | null };

export type SegmentProspect = {
  id: string;
  companyId: string;
  companyName: string;
  stage: string;
  ownerName: string | null;
  lastInteractionAt: string | null;
};

export type SegmentSummary = {
  total: number;
  active: number;
  won: number;
  conversionPct: number;
};

export type SegmentReport =
  | { state: "ok"; summary: SegmentSummary; prospects: SegmentProspect[]; truncated: boolean }
  | { state: "empty" }
  | { state: "error" };

// A single channel could hold far more prospects than anyone reads in a
// slide-over. The cap keeps the payload bounded at the brief's reference
// scale; `truncated` tells the panel to say so rather than quietly showing a
// partial list as if it were the whole segment.
const SEGMENT_LIMIT = 200;

function predicateFor(segment: Segment): SQL {
  if (segment.kind === "channel") return sql`p.channel::text = ${segment.channel}`;
  return segment.utmSource === null
    ? sql`p.channel = 'website' and p.utm_source is null`
    : sql`p.channel = 'website' and p.utm_source = ${segment.utmSource}`;
}

/** Backs the Source screen's slide-over: every prospect behind one donut
 * segment, plus the same headline numbers the hover card shows. */
export async function getSegmentProspects(segment: Segment): Promise<SegmentReport> {
  try {
    const where = predicateFor(segment);

    const [totals] = await db.execute<{ total: number; active: number; won: number }>(sql`
      select
        count(*)::int as total,
        count(*) filter (where p.current_stage not in ('Won', 'Lost'))::int as active,
        count(*) filter (where p.current_stage = 'Won')::int as won
      from prospects p
      where ${where}
    `);

    const total = totals?.total ?? 0;
    if (total === 0) return { state: "empty" };

    const rows = await db.execute<{
      id: string;
      company_id: string;
      company_name: string;
      stage: string;
      owner_name: string | null;
      last_interaction_at: string | null;
    }>(sql`
      select
        p.id, c.id as company_id, c.name as company_name,
        p.current_stage::text as stage,
        u.name as owner_name,
        p.last_interaction_at
      from prospects p
      join companies c on c.id = p.company_id
      left join users u on u.id = p.owner_id
      where ${where}
      order by p.last_interaction_at desc nulls last, c.name asc
      limit ${SEGMENT_LIMIT}
    `);

    const won = totals?.won ?? 0;
    return {
      state: "ok",
      summary: {
        total,
        active: totals?.active ?? 0,
        won,
        conversionPct: Math.round((won / total) * 1000) / 10,
      },
      prospects: rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        companyName: r.company_name,
        stage: r.stage,
        ownerName: r.owner_name,
        lastInteractionAt: r.last_interaction_at,
      })),
      truncated: total > SEGMENT_LIMIT,
    };
  } catch (err) {
    console.error("[dashboard/source] segment query failed:", err);
    return { state: "error" };
  }
}

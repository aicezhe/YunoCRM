import { sql } from "drizzle-orm";
import { db } from "@/db";

export type ChannelRow = {
  channel: string;
  total: number;
  active: number;
  won: number;
  conversionPct: number;
};

export type UtmRow = {
  utmSource: string;
  total: number;
};

export type SourceReport =
  | { state: "ok"; channels: ChannelRow[]; utm: UtmRow[] }
  | { state: "empty" }
  | { state: "error" };

/**
 * `manual` exists in channel_type for admin-entered records but isn't one of
 * the five acquisition channels named in the brief, so it's excluded from
 * this report — it would otherwise show up as a channel with no real
 * marketing meaning behind it.
 */
const NAMED_CHANNELS = ["website", "linkedin_outbound", "referral", "event", "content_inbound"] as const;

export async function getSourceReport(): Promise<SourceReport> {
  try {
    const rows = await db.execute<{ channel: string; total: number; active: number; won: number }>(sql`
      select
        channel::text as channel,
        count(*)::int as total,
        count(*) filter (where current_stage not in ('Won', 'Lost'))::int as active,
        count(*) filter (where current_stage = 'Won')::int as won
      from prospects
      group by channel
    `);

    if (rows.length === 0) return { state: "empty" };

    // Only the five channels named in the brief are shown — `manual` (admin-
    // entered records) has no marketing meaning and is dropped here, even if
    // it has rows.
    const byChannel = new Map(rows.map((r) => [r.channel, r]));
    const channels: ChannelRow[] = NAMED_CHANNELS.map((channel) => {
      const row = byChannel.get(channel);
      const total = row?.total ?? 0;
      const won = row?.won ?? 0;
      return {
        channel,
        total,
        active: row?.active ?? 0,
        won,
        conversionPct: total === 0 ? 0 : Math.round((won / total) * 1000) / 10,
      };
    }).sort((a, b) => b.conversionPct - a.conversionPct);

    if (channels.every((c) => c.total === 0)) return { state: "empty" };

    const utmRows = await db.execute<{ utm_source: string | null; total: number }>(sql`
      select utm_source, count(*)::int as total
      from prospects
      where channel = 'website'
      group by utm_source
      order by total desc
    `);
    const utm: UtmRow[] = utmRows.map((r) => ({ utmSource: r.utm_source ?? "(not set)", total: r.total }));

    return { state: "ok", channels, utm };
  } catch (err) {
    console.error("[dashboard/source] query failed:", err);
    return { state: "error" };
  }
}

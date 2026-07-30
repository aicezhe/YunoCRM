import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { client, db } from "@/db";
import { getStageReport, FUNNEL_STAGES } from "./by-stage/queries";
import { getTimeReport } from "./time/queries";
import { getSourceReport } from "./source/queries";
import { getWitheringReport, COLD_THRESHOLD_DAYS } from "./withering/queries";
import { getRecentActivity, getDataAsOf } from "./metrics";

/**
 * The dashboard numbers ARE SQL. Reimplementing those aggregates in
 * TypeScript to unit-test them would only prove the copy agrees with itself,
 * so each block below re-derives the same figure a *different* way — a
 * correlated subquery where the shipped query uses a window function, a
 * separate count where it uses a filter — and compares. A drift in either
 * direction fails the test.
 *
 * Requires a database with the seeded fixture loaded: `npm run test:db`.
 */

afterAll(async () => {
  await client.end();
});

async function scalar<T>(query: ReturnType<typeof sql>): Promise<T> {
  const [row] = await db.execute<{ v: T }>(query);
  return row.v;
}

describe("By stage", () => {
  it("counts every prospect exactly once across the stages", async () => {
    const report = await getStageReport();
    expect(report.state).toBe("ok");
    if (report.state !== "ok") return;

    const total = await scalar<number>(sql`select count(*)::int as v from prospects`);
    expect(report.total).toBe(total);

    // Nothing may fall outside the enum list the chart renders — if a new
    // funnel_stage value were added and FUNNEL_STAGES not updated, its
    // prospects would silently vanish from the screen.
    const summed = report.stages.reduce((n, s) => n + s.count, 0);
    expect(summed).toBe(total);
    expect(report.stages.map((s) => s.stage)).toEqual([...FUNNEL_STAGES]);
  });

  it("matches an independent per-stage count", async () => {
    const report = await getStageReport();
    if (report.state !== "ok") throw new Error("expected ok");

    for (const row of report.stages) {
      const actual = await scalar<number>(
        sql`select count(*)::int as v from prospects where current_stage::text = ${row.stage}`
      );
      expect({ stage: row.stage, count: row.count }).toEqual({ stage: row.stage, count: actual });
    }
  });

  it("reports percentages that add up", async () => {
    const report = await getStageReport();
    if (report.state !== "ok") throw new Error("expected ok");
    const sum = report.stages.reduce((n, s) => n + s.pct, 0);
    // Each pct is rounded to one decimal, so eight rows can drift by up to
    // 0.4 in total — anything beyond that is a real accounting error.
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.4);
  });
});

describe("Time in stage", () => {
  // Two transitions can share a timestamp: one inbound email creates a
  // website lead and counts as the first contact, emitting `→ Lead` and
  // `Lead → Contacted` at the same instant. This is why the shipped query
  // orders by (occurred_at, to_stage) — ordering by the timestamp alone
  // leaves the pair in arbitrary order and the durations move between runs.
  it("still contains the same-timestamp transitions this ordering exists for", async () => {
    const ties = await scalar<number>(sql`
      select count(*)::int as v from (
        select prospect_id, occurred_at from stage_transitions
        group by prospect_id, occurred_at having count(*) > 1
      ) t
    `);
    expect(ties).toBeGreaterThan(0);
  });

  it("matches an average re-derived by ordered lookup instead of a window function", async () => {
    const report = await getTimeReport();
    expect(report.state).toBe("ok");
    if (report.state !== "ok") return;

    for (const row of report.stages) {
      // Same "next transition in funnel order" semantics, different
      // mechanism: a row-wise tuple comparison with ORDER BY ... LIMIT 1,
      // where the shipped query uses lead() over a window.
      const independent = await scalar<string | null>(sql`
        select round(avg(extract(epoch from (nx.next_at - st.occurred_at)) / 86400)::numeric, 1) as v
        from stage_transitions st
        cross join lateral (
          select n.occurred_at as next_at
          from stage_transitions n
          where n.prospect_id = st.prospect_id
            and (n.occurred_at, n.to_stage) > (st.occurred_at, st.to_stage)
          order by n.occurred_at, n.to_stage
          limit 1
        ) nx
        where st.to_stage::text = ${row.stage} and nx.next_at is not null
      `);
      const expected = independent === null ? null : Number(independent);
      expect({ stage: row.stage, avg: row.avgDays }).toEqual({ stage: row.stage, avg: expected });
    }
  });

  it("measures how long the ongoing prospects have already waited", async () => {
    const report = await getTimeReport();
    if (report.state !== "ok") throw new Error("expected ok");

    for (const row of report.stages) {
      // Re-derived from `prospects.current_stage` and the transition that put
      // each one there, rather than from the window function's null-next rows.
      const independent = await db.execute<{ avg: string | null; max: string | null; n: number }>(sql`
        with as_of as (select max(occurred_at) as at from interactions),
        entered as (
          select p.id, max(st.occurred_at) as entered_at
          from prospects p
          join stage_transitions st on st.prospect_id = p.id and st.to_stage = p.current_stage
          where p.current_stage::text = ${row.stage}
          group by p.id
        )
        select
          round(avg(extract(epoch from ((select at from as_of) - entered_at)) / 86400)::numeric, 1) as avg,
          round(max(extract(epoch from ((select at from as_of) - entered_at)) / 86400)::numeric, 1) as max,
          count(*)::int as n
        from entered
      `);
      const [{ avg, max, n }] = independent;

      expect({ stage: row.stage, n: row.ongoing }).toEqual({ stage: row.stage, n });
      expect({ stage: row.stage, avg: row.ongoingAvgDays }).toEqual({
        stage: row.stage,
        avg: avg === null ? null : Number(avg),
      });
      expect({ stage: row.stage, max: row.ongoingMaxDays }).toEqual({
        stage: row.stage,
        max: max === null ? null : Number(max),
      });
    }
  });

  it("shows the throughput average can hide a backlog, which is why both are reported", async () => {
    const report = await getTimeReport();
    if (report.state !== "ok") throw new Error("expected ok");

    // The point of the back of the card. A stage whose completed transitions
    // clear in ~a day can still have prospects rotting in it for months —
    // they are excluded from the average precisely because they never moved.
    // If this ever stops holding on the fixture the screen's framing is
    // wrong, not the test.
    const misleading = report.stages.filter(
      (s) => s.avgDays !== null && s.ongoingAvgDays !== null && s.ongoingAvgDays > s.avgDays * 10
    );
    expect(misleading.length).toBeGreaterThan(0);
  });

  it("gives the tied Lead stage a zero-day duration rather than the next stage's", async () => {
    // The concrete regression the ordering guards against: for a prospect
    // created and contacted by the same email, Lead lasted no time at all.
    const zeroSpans = await scalar<number>(sql`
      with spans as (
        select to_stage, occurred_at,
               lead(occurred_at) over (partition by prospect_id order by occurred_at, to_stage) as next_at
        from stage_transitions
      )
      select count(*)::int as v from spans
      where to_stage = 'Lead' and next_at is not null and next_at = occurred_at
    `);
    expect(zeroSpans).toBeGreaterThan(0);
  });

  it("splits completed and ongoing transitions without losing any", async () => {
    const report = await getTimeReport();
    if (report.state !== "ok") throw new Error("expected ok");

    for (const row of report.stages) {
      const total = await scalar<number>(
        sql`select count(*)::int as v from stage_transitions where to_stage::text = ${row.stage}`
      );
      // "Ongoing" is exactly the prospects currently sitting in that stage,
      // which is what makes excluding them from the average defensible.
      const ongoing = await scalar<number>(
        sql`select count(*)::int as v from prospects where current_stage::text = ${row.stage}`
      );
      expect({ stage: row.stage, completed: row.completed, ongoing: row.ongoing }).toEqual({
        stage: row.stage,
        completed: total - ongoing,
        ongoing,
      });
    }
  });
});

describe("Source", () => {
  it("matches independent per-channel totals and win rates", async () => {
    const report = await getSourceReport();
    expect(report.state).toBe("ok");
    if (report.state !== "ok") return;

    for (const row of report.channels) {
      const total = await scalar<number>(
        sql`select count(*)::int as v from prospects where channel::text = ${row.channel}`
      );
      const won = await scalar<number>(
        sql`select count(*)::int as v from prospects where channel::text = ${row.channel} and current_stage = 'Won'`
      );
      const active = await scalar<number>(sql`
        select count(*)::int as v from prospects
        where channel::text = ${row.channel} and current_stage not in ('Won', 'Lost')
      `);

      expect({ ch: row.channel, total: row.total, won: row.won, active: row.active }).toEqual({
        ch: row.channel,
        total,
        won,
        active,
      });
      // The card labels this "win rate", i.e. won out of ALL prospects for
      // the channel — not out of the closed ones.
      const expectedPct = total === 0 ? 0 : Math.round((won / total) * 1000) / 10;
      expect(row.conversionPct).toBe(expectedPct);
    }
  });

  it("breaks the website channel down by utm_source without dropping rows", async () => {
    const report = await getSourceReport();
    if (report.state !== "ok") throw new Error("expected ok");

    const websiteTotal = await scalar<number>(
      sql`select count(*)::int as v from prospects where channel = 'website'`
    );
    const summed = report.utm.reduce((n, u) => n + u.total, 0);
    expect(summed).toBe(websiteTotal);
  });
});

describe("Withering", () => {
  it("flags exactly the open prospects past the cold threshold", async () => {
    const report = await getWitheringReport();
    expect(report.state).toBe("ok");
    if (report.state !== "ok") return;

    // Measured against the newest event in the dataset, not the wall clock —
    // the same anchor the shipped query uses, restated here independently.
    const expected = await scalar<number>(sql`
      with as_of as (select max(occurred_at) at from interactions)
      select count(*)::int as v from prospects p
      where p.current_stage not in ('Won', 'Lost')
        and (
          p.last_interaction_at is null
          or p.last_interaction_at < (select at from as_of) - make_interval(days => ${COLD_THRESHOLD_DAYS})
        )
    `);
    expect(report.rows.length).toBe(expected);
  });

  it("never lists a Won or Lost prospect, and every row is genuinely cold", async () => {
    const report = await getWitheringReport();
    if (report.state !== "ok") throw new Error("expected ok");

    for (const row of report.rows) {
      expect(["Won", "Lost"]).not.toContain(row.currentStage);
      expect(row.daysCold).toBeGreaterThanOrEqual(COLD_THRESHOLD_DAYS);
    }
  });

  it("sorts the coldest first", async () => {
    const report = await getWitheringReport();
    if (report.state !== "ok") throw new Error("expected ok");
    const days = report.rows.map((r) => r.daysCold);
    expect([...days].sort((a, b) => b - a)).toEqual(days);
  });
});

describe("Recent activity", () => {
  it("returns the newest interactions, newest first", async () => {
    const report = await getRecentActivity(5);
    expect(report.state).toBe("ok");
    if (report.state !== "ok") return;

    const rows = await db.execute<{ occurred_at: string; company_name: string }>(sql`
      select i.occurred_at, c.name as company_name
      from interactions i
      join prospects p on p.id = i.prospect_id
      join companies c on c.id = p.company_id
      order by i.occurred_at desc
      limit 5
    `);

    expect(report.items.map((i) => i.companyName)).toEqual(rows.map((r) => r.company_name));
    const times = report.items.map((i) => new Date(i.occurredAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("anchors the 'as of' date to the newest interaction", async () => {
    const asOf = await getDataAsOf();
    const newest = await scalar<string>(sql`select max(occurred_at)::text as v from interactions`);
    expect(asOf).not.toBeNull();
    expect(new Date(asOf!).getTime()).toBe(new Date(newest).getTime());
  });
});

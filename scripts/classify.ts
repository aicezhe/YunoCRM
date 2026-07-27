/**
 * Classification — the step after ingest.ts.
 *
 * Reads raw_events where status = 'pending' and resolves each one using the
 * ordered rule registry in ./classification-rules.ts, then writes the
 * outcome back and creates quarantine_items for quarantined records.
 *
 * No AI/fuzzy-matching happens here — quarantine_items get a bare `reason`
 * (the matched rule id). Suggesting a resolution is a separate, later step.
 *
 * Run: npm run classify
 */

import { eq } from "drizzle-orm";
import { db, client } from "../src/db";
import { rawEvents, quarantineItems, contacts, companies } from "../drizzle/schema";
import { classifyRow, type CalendarPayload, type ClassificationContext, type RawEventRow } from "./classification-rules";

async function buildContext(pending: RawEventRow[]): Promise<ClassificationContext> {
  const [contactRows, companyRows, allCalendarRows] = await Promise.all([
    db.select({ email: contacts.email }).from(contacts),
    db.select({ domain: companies.domain }).from(companies),
    db
      .select({ externalId: rawEvents.externalId, payload: rawEvents.payload })
      .from(rawEvents)
      .where(eq(rawEvents.source, "calendar")),
  ]);

  const duplicateKeys = new Set<string>();
  const seen = new Set<string>();
  for (const row of pending) {
    const key = `${row.source}:${row.externalId}`;
    if (seen.has(key)) duplicateKeys.add(key);
    seen.add(key);
  }

  return {
    knownContactEmails: new Set(contactRows.map((c) => c.email.toLowerCase())),
    knownCompanyDomains: new Set(companyRows.map((c) => c.domain).filter((d): d is string => d !== null)),
    calendarEvents: allCalendarRows.map((r) => {
      const payload = r.payload as CalendarPayload;
      return { externalId: r.externalId, title: payload.title, start: payload.start };
    }),
    duplicateKeys,
  };
}

async function main() {
  const pending = await db.select().from(rawEvents).where(eq(rawEvents.status, "pending"));
  const ctx = await buildContext(pending);

  const outcomeCounts = new Map<string, number>(); // key: `${source}:${outcome}`
  const ruleCounts = new Map<string, number>(); // key: matchedRule

  for (const row of pending) {
    const { outcome, matchedRule } = classifyRow(row, ctx);

    if (outcome === "quarantined") {
      await db.transaction(async (tx) => {
        await tx.update(rawEvents).set({ status: outcome, matchedRule }).where(eq(rawEvents.id, row.id));
        await tx.insert(quarantineItems).values({ rawEventId: row.id, reason: matchedRule });
      });
    } else {
      await db.update(rawEvents).set({ status: outcome, matchedRule }).where(eq(rawEvents.id, row.id));
    }

    const outcomeKey = `${row.source}:${outcome}`;
    outcomeCounts.set(outcomeKey, (outcomeCounts.get(outcomeKey) ?? 0) + 1);
    ruleCounts.set(matchedRule, (ruleCounts.get(matchedRule) ?? 0) + 1);
  }

  console.log("\n=== Classification summary ===");
  console.log(`Records classified: ${pending.length}`);

  console.log("\nBy outcome (source: outcome -> count):");
  console.table(
    [...outcomeCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => {
        const [source, outcome] = key.split(":");
        return { source, outcome, count };
      })
  );

  console.log("\nBy matched_rule:");
  console.table([...ruleCounts.entries()].sort((a, b) => b[1] - a[1]).map(([rule, count]) => ({ rule, count })));
}

main()
  .catch((err) => {
    console.error("Classification failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });

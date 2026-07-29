/**
 * Read-only preview of what the filtering fixes would change.
 *
 * Runs the CURRENT rule registry against every raw_event already in the
 * database and diffs the result against what is stored, then reports the
 * company-name repairs (placeholder backfill + stray-character cleanup)
 * that resolve.ts would now apply. Writes nothing — this exists so the
 * changes can be reviewed before any pipeline re-run touches real data.
 *
 * Run: npm run audit-filtering
 */

import { eq } from "drizzle-orm";
import { db, client } from "../src/db";
import { companies, contacts, rawEvents } from "../drizzle/schema";
import {
  classifyRow,
  splitEmail,
  type CalendarPayload,
  type ClassificationContext,
  type EmailPayload,
  type RawEventRow,
} from "./classification-rules";
import { cleanCompanyName, companyNameFromBody, companyNameFromSubject, isPlaceholderCompanyName } from "./resolution-rules";

async function buildContext(rows: RawEventRow[]): Promise<ClassificationContext> {
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
  for (const row of rows) {
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

function heading(text: string) {
  console.log(`\n${text}\n${"─".repeat(text.length)}`);
}

async function main() {
  const all = await db.select().from(rawEvents);
  const ctx = await buildContext(all as RawEventRow[]);

  // --- 1. Reclassification diff -----------------------------------------
  // Rows already resolved by hand through the quarantine screen are skipped:
  // their matched_rule records a human decision, not a rule outcome.
  const changes: { subject: string; from: string; to: string; sender: string }[] = [];
  for (const row of all as RawEventRow[]) {
    if (row.status !== "pending" && String((row as { matchedRule?: string }).matchedRule ?? "").startsWith("quarantine_")) {
      continue;
    }
    const { outcome, matchedRule } = classifyRow(row, ctx);
    const storedRule = String((row as { matchedRule?: string }).matchedRule ?? "");
    if (outcome !== row.status || matchedRule !== storedRule) {
      const p = row.payload as EmailPayload & CalendarPayload;
      changes.push({
        subject: p.subject ?? p.title ?? "(no subject)",
        sender: p.from ?? p.organizer ?? "",
        from: `${row.status}/${storedRule}`,
        to: `${outcome}/${matchedRule}`,
      });
    }
  }

  // Changes that flip an event between processed/ignored/quarantined are the
  // ones that actually alter the CRM. The rest are audit-trail drift: on the
  // first classify run contacts/companies were still empty, so mail that
  // known_contact/known_domain would match today fell through to
  // default_processed. Same outcome, different label — listed as a count only.
  const real = changes.filter((c) => c.from.split("/")[0] !== c.to.split("/")[0]);
  const relabels = changes.length - real.length;

  heading(`1. Reclassification — ${real.length} event(s) change outcome`);
  for (const c of real) {
    console.log(`  ${c.from}  ->  ${c.to}`);
    console.log(`     ${c.sender}  “${c.subject}”`);
  }
  if (real.length === 0) console.log("  (nothing)");
  if (relabels > 0) {
    console.log(
      `\n  Plus ${relabels} event(s) keep the same outcome but get a more precise` +
        `\n  rule label (default_processed -> known_contact/known_domain), because` +
        `\n  contacts and companies exist now and did not on the first run.`
    );
  }

  // --- 2. Placeholder company names -------------------------------------
  const companyRows = await db.select().from(companies);
  const emails = (all as RawEventRow[]).filter((r) => r.source === "email");

  heading("2. Company names — placeholder backfill");
  let backfills = 0;
  for (const co of companyRows) {
    if (!isPlaceholderCompanyName(co.name, co.domain)) continue;
    // The name resolve.ts would find by scanning every later message from
    // this domain, not just the first one it happened to see.
    let found: string | null = null;
    for (const ev of emails) {
      const p = ev.payload as EmailPayload;
      if (splitEmail(p.from).domain !== co.domain) continue;
      found = companyNameFromSubject(p.subject) ?? companyNameFromBody(p.body);
      if (found) break;
    }
    if (found) {
      backfills++;
      console.log(`  "${co.name}"  ->  "${cleanCompanyName(found)}"`);
    } else {
      console.log(`  "${co.name}"  ->  (no name found in any message — stays as is)`);
    }
  }
  if (backfills === 0 && companyRows.every((c) => !isPlaceholderCompanyName(c.name, c.domain))) {
    console.log("  (nothing)");
  }

  // --- 3. Stray-character cleanup ---------------------------------------
  heading("3. Company names — stray-character cleanup");
  let cleaned = 0;
  for (const co of companyRows) {
    const fixed = cleanCompanyName(co.name);
    if (fixed !== co.name) {
      cleaned++;
      console.log(`  "${co.name}"  ->  "${fixed}"`);
    }
  }
  if (cleaned === 0) console.log("  (nothing)");

  console.log("\nNothing was written to the database.\n");
}

main()
  .catch((err) => {
    console.error("Audit failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });

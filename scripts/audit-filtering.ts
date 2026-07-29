/**
 * Preview — and optionally apply — the filtering fixes.
 *
 * Runs the CURRENT rule registry against every raw_event already in the
 * database and diffs the result against what is stored, then reports the
 * company-name repairs (placeholder backfill + stray-character cleanup)
 * that resolve.ts would now apply.
 *
 * Without --apply it writes nothing, so the changes can be reviewed before
 * anything touches real data. With --apply it performs exactly what the
 * preview listed, and nothing else:
 *   - reclassifies the events whose OUTCOME changes (label-only drift is
 *     left alone — rewriting 135 audit trails to say the same thing adds
 *     no information and loses the record of what the first run decided),
 *   - deletes the company/prospect/contact rows that only exist because a
 *     now-filtered event was previously let through,
 *   - renames placeholder and stray-character company names.
 *
 * A plain `npm run resolve` cannot do the last two: it skips raw_events
 * that already have an interaction, so historic rows are never revisited.
 *
 * Run: npm run audit-filtering [-- --apply]
 */

import { eq, inArray } from "drizzle-orm";
import { db, client } from "../src/db";
import { companies, contacts, interactions, prospects, rawEvents } from "../drizzle/schema";
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
  const apply = process.argv.includes("--apply");
  const all = await db.select().from(rawEvents);
  const ctx = await buildContext(all as RawEventRow[]);

  // --- 1. Reclassification diff -----------------------------------------
  // Rows already resolved by hand through the quarantine screen are skipped:
  // their matched_rule records a human decision, not a rule outcome.
  const changes: {
    id: string;
    subject: string;
    from: string;
    to: string;
    sender: string;
    outcome: string;
    matchedRule: string;
  }[] = [];
  for (const row of all as RawEventRow[]) {
    if (row.status !== "pending" && String((row as { matchedRule?: string }).matchedRule ?? "").startsWith("quarantine_")) {
      continue;
    }
    const { outcome, matchedRule } = classifyRow(row, ctx);
    const storedRule = String((row as { matchedRule?: string }).matchedRule ?? "");
    if (outcome !== row.status || matchedRule !== storedRule) {
      const p = row.payload as EmailPayload & CalendarPayload;
      changes.push({
        id: row.id,
        subject: p.subject ?? p.title ?? "(no subject)",
        sender: p.from ?? p.organizer ?? "",
        from: `${row.status}/${storedRule}`,
        to: `${outcome}/${matchedRule}`,
        outcome,
        matchedRule,
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
  const renames: { id: string; from: string; to: string }[] = [];
  // Companies whose every message is now filtered out: they only exist
  // because a now-ignored event was previously let through.
  const orphaned: { id: string; name: string }[] = [];
  const nowIgnoredIds = new Set(real.filter((c) => c.outcome === "ignored").map((c) => c.id));

  for (const co of companyRows) {
    if (!isPlaceholderCompanyName(co.name, co.domain)) continue;
    // The name resolve.ts would find by scanning every later message from
    // this domain, not just the first one it happened to see.
    let found: string | null = null;
    const fromDomain = emails.filter((ev) => splitEmail((ev.payload as EmailPayload).from).domain === co.domain);
    for (const ev of fromDomain) {
      const p = ev.payload as EmailPayload;
      found = companyNameFromSubject(p.subject) ?? companyNameFromBody(p.body);
      if (found) break;
    }
    if (found) {
      renames.push({ id: co.id, from: co.name, to: cleanCompanyName(found) });
      console.log(`  "${co.name}"  ->  "${cleanCompanyName(found)}"`);
    } else if (fromDomain.length > 0 && fromDomain.every((ev) => nowIgnoredIds.has(ev.id))) {
      orphaned.push({ id: co.id, name: co.name });
      console.log(`  "${co.name}"  ->  every message from this domain is now filtered out (see §4)`);
    } else {
      console.log(`  "${co.name}"  ->  (no name found in any message — stays as is)`);
    }
  }
  if (companyRows.every((c) => !isPlaceholderCompanyName(c.name, c.domain))) console.log("  (nothing)");

  // --- 3. Stray-character cleanup ---------------------------------------
  heading("3. Company names — stray-character cleanup");
  let cleaned = 0;
  for (const co of companyRows) {
    const fixed = cleanCompanyName(co.name);
    if (fixed !== co.name) {
      cleaned++;
      renames.push({ id: co.id, from: co.name, to: fixed });
      console.log(`  "${co.name}"  ->  "${fixed}"`);
    }
  }
  if (cleaned === 0) console.log("  (nothing)");

  // --- 4. Rows to remove -------------------------------------------------
  heading(`4. Rows built from now-filtered events — ${orphaned.length} company/companies`);
  for (const o of orphaned) {
    const [prospect] = await db.select({ id: prospects.id }).from(prospects).where(eq(prospects.companyId, o.id));
    const contactRows = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.companyId, o.id));
    const interactionCount = prospect
      ? (await db.select({ id: interactions.id }).from(interactions).where(eq(interactions.prospectId, prospect.id)))
          .length
      : 0;
    console.log(
      `  "${o.name}": 1 company, ${prospect ? 1 : 0} prospect, ${contactRows.length} contact(s), ` +
        `${interactionCount} interaction(s) (+ their stage transitions and tasks, by cascade)`
    );
  }
  if (orphaned.length === 0) console.log("  (nothing)");

  if (!apply) {
    console.log("\nNothing was written to the database. Re-run with --apply to perform the above.\n");
    return;
  }

  // --- Apply -------------------------------------------------------------
  heading("Applying");

  for (const c of real) {
    await db
      .update(rawEvents)
      .set({ status: c.outcome, matchedRule: c.matchedRule })
      .where(eq(rawEvents.id, c.id));
  }
  console.log(`  reclassified ${real.length} raw_event(s)`);

  for (const o of orphaned) {
    // prospects -> interactions/stage_transitions/tasks cascade; contacts and
    // prospects both RESTRICT the company, so they go first.
    const prospectRows = await db.select({ id: prospects.id }).from(prospects).where(eq(prospects.companyId, o.id));
    if (prospectRows.length) {
      await db.delete(prospects).where(
        inArray(
          prospects.id,
          prospectRows.map((p) => p.id)
        )
      );
    }
    await db.delete(contacts).where(eq(contacts.companyId, o.id));
    await db.delete(companies).where(eq(companies.id, o.id));
    console.log(`  removed "${o.name}" and everything hanging off it`);
  }

  for (const r of renames) {
    await db.update(companies).set({ name: r.to }).where(eq(companies.id, r.id));
    console.log(`  renamed "${r.from}" -> "${r.to}"`);
  }

  console.log("\nDone.\n");
}

main()
  .catch((err) => {
    console.error("Audit failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });

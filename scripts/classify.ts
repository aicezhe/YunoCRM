/**
 * Classification — the step after ingest.ts.
 *
 * Reads raw_events where status = 'pending' and resolves each one to
 * exactly one outcome (ignored / processed / quarantined) using an ordered
 * rule registry: first matching rule wins, evaluation stops there. Rules are
 * exported individually so each can be unit-tested in isolation.
 *
 * Rule order and detection logic come from DECISIONS.md §3, with one
 * addition — `default_processed` (see note below `RULES`) — agreed with the
 * project owner to avoid flooding quarantine on a first run, before
 * companies/contacts exist yet for known_contact/known_domain to match
 * against.
 *
 * No AI/fuzzy-matching happens here — quarantine_items get a bare `reason`
 * (the matched rule id). Suggesting a resolution is a separate, later step.
 *
 * Run: npm run classify
 */

import { eq } from "drizzle-orm";
import { db, client } from "../src/db";
import { rawEvents, quarantineItems, contacts, companies } from "../drizzle/schema";

// --- Constants sourced from DECISIONS.md — do not invent, keep in sync ----
const YUNO_DOMAIN = "yunoai.io"; // DECISIONS.md §1
const PERSONAL_DOMAINS = ["gmail.com", "libero.it", "outlook.com"]; // DECISIONS.md §3, rule `personal_domain`
const BULK_LOCAL_PARTS = ["noreply", "newsletter", "events", "billing", "notifications"]; // DECISIONS.md §3, rule `external_bulk`
const WEBSITE_LEAD_BODY_PATTERN = /Nome:|Email:|Azienda:|Messaggio:|UTM source:/; // DECISIONS.md §2.1

type Outcome = "ignored" | "processed" | "quarantined";

interface EmailPayload {
  message_id: string;
  thread_id: string;
  timestamp: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

interface CalendarPayload {
  event_id: string;
  title: string;
  start: string;
  end: string;
  organizer: string;
  attendees: string[];
  location: string;
  description: string;
  status: string;
}

interface RawEventRow {
  id: string;
  source: string;
  externalId: string;
  payload: unknown;
  status: string;
}

interface ClassificationContext {
  knownContactEmails: Set<string>;
  knownCompanyDomains: Set<string>;
  calendarEvents: { externalId: string; title: string; start: string }[];
  duplicateKeys: Set<string>;
}

interface Rule {
  id: string;
  priority: number;
  outcome: Outcome;
  predicate: (row: RawEventRow, ctx: ClassificationContext) => boolean;
  /** Optional finer-grained matched_rule value for audit (e.g. reschedule vs final cancellation). */
  detail?: (row: RawEventRow, ctx: ClassificationContext) => string;
}

function splitEmail(address: string): { local: string; domain: string } {
  const at = address.indexOf("@");
  if (at === -1) return { local: address, domain: "" };
  return { local: address.slice(0, at), domain: address.slice(at + 1) };
}

function isYunoAddress(address: string): boolean {
  return splitEmail(address).domain === YUNO_DOMAIN;
}

/** Strips non-letters so "no-reply" and "noreply" are treated as the same local part. */
function normalizeLocalPart(local: string): string {
  return local.toLowerCase().replace(/[^a-z]/g, "");
}

function asEmailPayload(row: RawEventRow): EmailPayload {
  return row.payload as EmailPayload;
}

function asCalendarPayload(row: RawEventRow): CalendarPayload {
  return row.payload as CalendarPayload;
}

/** "Demo Yuno x {company}" / "Check-in trial — {company}" -> {company}, or null if the title doesn't match either template. */
function extractEventCompany(title: string): string | null {
  const demoMatch = title.match(/^Demo Yuno x (.+)$/);
  if (demoMatch) return demoMatch[1].trim();
  const trialMatch = title.match(/^Check-in trial\s*[—-]\s*(.+)$/);
  if (trialMatch) return trialMatch[1].trim();
  return null;
}

/** DECISIONS.md §3.1 / §8: a later same-company Demo/Check-in event makes a cancellation a reschedule, not a final drop. */
function isReschedule(row: RawEventRow, ctx: ClassificationContext): boolean {
  const payload = asCalendarPayload(row);
  const company = extractEventCompany(payload.title);
  if (!company) return false;
  const thisStart = new Date(payload.start).getTime();
  return ctx.calendarEvents.some(
    (other) =>
      other.externalId !== row.externalId &&
      extractEventCompany(other.title) === company &&
      new Date(other.start).getTime() > thisStart
  );
}

// --- Rule registry — ordered, first match wins (DECISIONS.md §3) ----------
//
// `default_processed` (priority 11) is not in DECISIONS.md's table. Without
// it, known_contact/known_domain can only match once companies/contacts are
// populated — on a first run (both tables empty) essentially all legitimate
// external correspondence would fall through to `unresolved` and flood
// quarantine, contradicting §2.3's own stated goal. Agreed with the project
// owner: anything that reaches this point is not bulk/personal/internal
// noise, so treat it as legitimate and hand it to the next pipeline stage;
// `unresolved` stays a true last-resort catch-all (malformed/ambiguous
// records only, e.g. the one non-templated tentative event).
export const duplicateRule: Rule = {
  id: "duplicate",
  priority: 1,
  outcome: "ignored",
  // raw_events' UNIQUE(source, external_id) (migration 0004) plus
  // ingest.ts's onConflictDoNothing already prevent this from ever being
  // true in practice — kept as a defensive, documented no-op.
  predicate: (row, ctx) => ctx.duplicateKeys.has(`${row.source}:${row.externalId}`),
};

export const websiteLeadRule: Rule = {
  id: "website_lead",
  priority: 2,
  outcome: "processed",
  predicate: (row) => row.source === "email" && WEBSITE_LEAD_BODY_PATTERN.test(asEmailPayload(row).body),
};

export const autoReplyRule: Rule = {
  id: "auto_reply",
  priority: 3,
  outcome: "ignored",
  predicate: (row) => row.source === "email" && /^Risposta automatica:/i.test(asEmailPayload(row).subject.trim()),
};

export const externalBulkRule: Rule = {
  id: "external_bulk",
  priority: 4,
  outcome: "ignored",
  predicate: (row) => {
    if (row.source !== "email") return false;
    const { local, domain } = splitEmail(asEmailPayload(row).from);
    return domain !== YUNO_DOMAIN && BULK_LOCAL_PARTS.includes(normalizeLocalPart(local));
  },
};

export const internalEmailRule: Rule = {
  id: "internal_email",
  priority: 5,
  outcome: "ignored",
  predicate: (row) => {
    if (row.source !== "email") return false;
    const payload = asEmailPayload(row);
    return isYunoAddress(payload.from) && payload.to.every(isYunoAddress) && payload.cc.every(isYunoAddress);
  },
};

export const internalEventRule: Rule = {
  id: "internal_event",
  priority: 6,
  outcome: "ignored",
  predicate: (row) => row.source === "calendar" && asCalendarPayload(row).attendees.every(isYunoAddress),
};

export const cancelledEventRule: Rule = {
  id: "cancelled_event",
  priority: 7,
  outcome: "ignored",
  predicate: (row) => row.source === "calendar" && asCalendarPayload(row).status === "cancelled",
  detail: (row, ctx) => (isReschedule(row, ctx) ? "cancelled_event:reschedule" : "cancelled_event:final"),
};

export const knownContactRule: Rule = {
  id: "known_contact",
  priority: 8,
  outcome: "processed",
  predicate: (row, ctx) =>
    row.source === "email" && ctx.knownContactEmails.has(asEmailPayload(row).from.toLowerCase()),
};

export const knownDomainRule: Rule = {
  id: "known_domain",
  priority: 9,
  outcome: "processed",
  predicate: (row, ctx) => {
    if (row.source !== "email") return false;
    const { domain } = splitEmail(asEmailPayload(row).from);
    return ctx.knownCompanyDomains.has(domain);
  },
};

export const personalDomainRule: Rule = {
  id: "personal_domain",
  priority: 10,
  outcome: "quarantined",
  predicate: (row) => row.source === "email" && PERSONAL_DOMAINS.includes(splitEmail(asEmailPayload(row).from).domain),
};

export const defaultProcessedRule: Rule = {
  id: "default_processed",
  priority: 11,
  outcome: "processed",
  predicate: (row) => {
    if (row.source === "email") return true;
    if (row.source === "calendar") return asCalendarPayload(row).status === "confirmed";
    return false;
  },
};

export const unresolvedRule: Rule = {
  id: "unresolved",
  priority: 12,
  outcome: "quarantined",
  predicate: () => true,
};

export const RULES: Rule[] = [
  duplicateRule,
  websiteLeadRule,
  autoReplyRule,
  externalBulkRule,
  internalEmailRule,
  internalEventRule,
  cancelledEventRule,
  knownContactRule,
  knownDomainRule,
  personalDomainRule,
  defaultProcessedRule,
  unresolvedRule,
];

export function classifyRow(
  row: RawEventRow,
  ctx: ClassificationContext
): { outcome: Outcome; matchedRule: string } {
  for (const rule of RULES) {
    if (rule.predicate(row, ctx)) {
      return { outcome: rule.outcome, matchedRule: rule.detail ? rule.detail(row, ctx) : rule.id };
    }
  }
  // Unreachable: unresolvedRule always matches.
  throw new Error(`No rule matched raw_event ${row.source}:${row.externalId}`);
}

async function buildContext(pending: RawEventRow[]): Promise<ClassificationContext> {
  const [contactRows, companyRows, allCalendarRows] = await Promise.all([
    db.select({ email: contacts.email }).from(contacts),
    db.select({ domain: companies.domain }).from(companies),
    db.select({ externalId: rawEvents.externalId, payload: rawEvents.payload }).from(rawEvents).where(eq(rawEvents.source, "calendar")),
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
  console.table(
    [...ruleCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([rule, count]) => ({ rule, count }))
  );
}

main()
  .catch((err) => {
    console.error("Classification failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });

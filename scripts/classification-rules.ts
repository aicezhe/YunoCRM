/**
 * Pure classification logic for raw_events — no I/O, no DB import, so it
 * can be unit-tested in isolation. scripts/classify.ts imports this module
 * and pairs it with the actual database read/write loop.
 *
 * Rule order and detection logic come from DECISIONS.md §3, with one
 * addition — `default_processed` (see note below `RULES`) — agreed with the
 * project owner to avoid flooding quarantine on a first run, before
 * companies/contacts exist yet for known_contact/known_domain to match
 * against.
 */

// --- Constants sourced from DECISIONS.md — do not invent, keep in sync ----
export const YUNO_DOMAIN = "yunoai.io"; // DECISIONS.md §1
export const PERSONAL_DOMAINS = ["gmail.com", "libero.it", "outlook.com"]; // DECISIONS.md §3, rule `personal_domain`
export const BULK_LOCAL_PARTS = ["noreply", "newsletter", "events", "billing", "notifications"]; // DECISIONS.md §3, rule `external_bulk`

// Role accounts that send hiring/careers mail. Not in DECISIONS.md: found
// during a data audit — recruiting@bigconsulting.com's "Opportunità di
// carriera" was creating a company and a Lead prospect, putting a job ad in
// the sales funnel. Deliberately narrow: the sender must BOTH be a hiring
// role account AND the subject must look like a job pitch, so a real
// prospect whose contact happens to sit in HR still comes through.
export const RECRUITING_LOCAL_PARTS = ["recruiting", "recruitment", "hr", "jobs", "careers", "talent"];
export const RECRUITING_SUBJECT_PATTERN =
  /(opportunit[àa]\s+di\s+carriera|offerta\s+di\s+lavoro|posizione\s+aperta|candidatur|job\s+opportunit|career\s+opportunit|we'?re\s+hiring)/i;
export const WEBSITE_LEAD_BODY_PATTERN = /Nome:|Email:|Azienda:|Messaggio:|UTM source:/; // DECISIONS.md §2.1

export type Outcome = "ignored" | "processed" | "quarantined";

export interface EmailPayload {
  message_id: string;
  thread_id: string;
  timestamp: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

export interface CalendarPayload {
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

export interface RawEventRow {
  id: string;
  source: string;
  externalId: string;
  payload: unknown;
  status: string;
}

export interface ClassificationContext {
  knownContactEmails: Set<string>;
  knownCompanyDomains: Set<string>;
  calendarEvents: { externalId: string; title: string; start: string }[];
  duplicateKeys: Set<string>;
}

export interface Rule {
  id: string;
  priority: number;
  outcome: Outcome;
  predicate: (row: RawEventRow, ctx: ClassificationContext) => boolean;
  /** Optional finer-grained matched_rule value for audit (e.g. reschedule vs final cancellation). */
  detail?: (row: RawEventRow, ctx: ClassificationContext) => string;
}

export function splitEmail(address: string): { local: string; domain: string } {
  const at = address.indexOf("@");
  if (at === -1) return { local: address, domain: "" };
  return { local: address.slice(0, at), domain: address.slice(at + 1) };
}

export function isYunoAddress(address: string): boolean {
  return splitEmail(address).domain === YUNO_DOMAIN;
}

/** Strips non-letters so "no-reply" and "noreply" are treated as the same local part. */
export function normalizeLocalPart(local: string): string {
  return local.toLowerCase().replace(/[^a-z]/g, "");
}

export function asEmailPayload(row: RawEventRow): EmailPayload {
  return row.payload as EmailPayload;
}

export function asCalendarPayload(row: RawEventRow): CalendarPayload {
  return row.payload as CalendarPayload;
}

/** "Demo Yuno x {company}" / "Check-in trial — {company}" -> {company}, or null if the title doesn't match either template. */
export function extractEventCompany(title: string): string | null {
  const demoMatch = title.match(/^Demo Yuno x (.+)$/);
  if (demoMatch) return demoMatch[1].trim();
  const trialMatch = title.match(/^Check-in trial\s*[—-]\s*(.+)$/);
  if (trialMatch) return trialMatch[1].trim();
  return null;
}

/** DECISIONS.md §3.1 / §8: a later same-company Demo/Check-in event makes a cancellation a reschedule, not a final drop. */
export function isReschedule(row: RawEventRow, ctx: ClassificationContext): boolean {
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
// `default_processed` (priority 12) is not in DECISIONS.md's table. Without
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

export const recruitingRule: Rule = {
  id: "recruiting",
  priority: 5,
  outcome: "ignored",
  predicate: (row) => {
    if (row.source !== "email") return false;
    const payload = asEmailPayload(row);
    const { local, domain } = splitEmail(payload.from);
    if (domain === YUNO_DOMAIN) return false;
    return (
      RECRUITING_LOCAL_PARTS.includes(normalizeLocalPart(local)) &&
      RECRUITING_SUBJECT_PATTERN.test(payload.subject.replace(/^\s*(re|fwd?|r)\s*:\s*/i, ""))
    );
  },
};

export const internalEmailRule: Rule = {
  id: "internal_email",
  priority: 6,
  outcome: "ignored",
  predicate: (row) => {
    if (row.source !== "email") return false;
    const payload = asEmailPayload(row);
    return isYunoAddress(payload.from) && payload.to.every(isYunoAddress) && payload.cc.every(isYunoAddress);
  },
};

export const internalEventRule: Rule = {
  id: "internal_event",
  priority: 7,
  outcome: "ignored",
  predicate: (row) => row.source === "calendar" && asCalendarPayload(row).attendees.every(isYunoAddress),
};

export const cancelledEventRule: Rule = {
  id: "cancelled_event",
  priority: 8,
  outcome: "ignored",
  predicate: (row) => row.source === "calendar" && asCalendarPayload(row).status === "cancelled",
  detail: (row, ctx) => (isReschedule(row, ctx) ? "cancelled_event:reschedule" : "cancelled_event:final"),
};

export const knownContactRule: Rule = {
  id: "known_contact",
  priority: 9,
  outcome: "processed",
  predicate: (row, ctx) =>
    row.source === "email" && ctx.knownContactEmails.has(asEmailPayload(row).from.toLowerCase()),
};

export const knownDomainRule: Rule = {
  id: "known_domain",
  priority: 10,
  outcome: "processed",
  predicate: (row, ctx) => {
    if (row.source !== "email") return false;
    const { domain } = splitEmail(asEmailPayload(row).from);
    return ctx.knownCompanyDomains.has(domain);
  },
};

export const personalDomainRule: Rule = {
  id: "personal_domain",
  priority: 11,
  outcome: "quarantined",
  predicate: (row) => row.source === "email" && PERSONAL_DOMAINS.includes(splitEmail(asEmailPayload(row).from).domain),
};

export const defaultProcessedRule: Rule = {
  id: "default_processed",
  priority: 12,
  outcome: "processed",
  predicate: (row) => {
    if (row.source === "email") return true;
    if (row.source === "calendar") return asCalendarPayload(row).status === "confirmed";
    return false;
  },
};

export const unresolvedRule: Rule = {
  id: "unresolved",
  priority: 13,
  outcome: "quarantined",
  predicate: () => true,
};

export const RULES: Rule[] = [
  duplicateRule,
  websiteLeadRule,
  autoReplyRule,
  externalBulkRule,
  recruitingRule,
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

/** Empty context — convenient base for tests that only care about envelope/content, not known-contact/reschedule lookups. */
export function emptyContext(): ClassificationContext {
  return {
    knownContactEmails: new Set(),
    knownCompanyDomains: new Set(),
    calendarEvents: [],
    duplicateKeys: new Set(),
  };
}

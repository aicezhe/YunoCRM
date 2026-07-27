/**
 * Read-only data exploration script — not part of the application.
 *
 * Prints statistics that back up the classification rules documented in
 * DECISIONS.md. Every constant below (Yuno's own domain, the personal-email
 * domain list) is copied from DECISIONS.md, not guessed — keep them in sync
 * if that file changes.
 *
 * Run: npm run explore
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// --- Constants sourced from DECISIONS.md — do not invent, keep in sync ---
const YUNO_DOMAIN = "yunoai.io"; // DECISIONS.md §1
const PERSONAL_DOMAINS = ["gmail.com", "libero.it", "outlook.com"]; // DECISIONS.md §3, rule `personal_domain`
const BULK_LOCAL_PARTS = ["noreply", "newsletter", "events", "billing", "notifications"]; // DECISIONS.md §3, rule `external_bulk`
const AUTO_REPLY_SUBJECT_PATTERNS = [
  /^risposta automatica/i, // DECISIONS.md §3, rule `auto_reply`
  /^out of office/i,
  /^automatic reply/i,
];
const WEBSITE_LEAD_BODY_PATTERN = /Nome:|Email:|Azienda:|Messaggio:|UTM source:/; // DECISIONS.md §2.1 structural template

interface EmailRecord {
  message_id: string;
  thread_id: string;
  timestamp: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

interface CalendarEvent {
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

interface SeedData {
  meta: {
    description: string;
    generated_at: string;
    period: { from: string; to: string };
    notes: string[];
    counts: { emails: number; calendar_events: number };
  };
  team: { name: string; email: string; role: string }[];
  emails: EmailRecord[];
  calendar_events: CalendarEvent[];
}

const DATA_PATH = join(process.cwd(), "data", "yuno-crm-seed-data.json");
const data: SeedData = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

function splitEmail(address: string): { local: string; domain: string } {
  const at = address.indexOf("@");
  if (at === -1) return { local: address, domain: "" };
  return { local: address.slice(0, at), domain: address.slice(at + 1) };
}

function isYunoAddress(address: string): boolean {
  return splitEmail(address).domain === YUNO_DOMAIN;
}

function countBy(items: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

function topCounts(items: string[], limit = 10): { value: string; count: number }[] {
  return [...countBy(items).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function section(n: number, title: string): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`${n}. ${title}`);
  console.log("=".repeat(72));
}

// --- 1. Overview ---------------------------------------------------------
section(1, "Overview");
console.log(`Period: ${data.meta.period.from} -> ${data.meta.period.to}`);
console.log(`Team: ${data.team.map((m) => `${m.name} (${m.role})`).join(", ")}`);
console.log(`Emails: ${data.emails.length} (meta.counts says ${data.meta.counts.emails})`);
console.log(
  `Calendar events: ${data.calendar_events.length} (meta.counts says ${data.meta.counts.calendar_events})`
);

// --- 2. Top domains and local parts of email senders ---------------------
section(2, "Top sender domains and local parts");
const senderDomains = data.emails.map((e) => splitEmail(e.from).domain);
const senderLocals = data.emails.map((e) => splitEmail(e.from).local);
console.log("\nTop domains:");
console.table(topCounts(senderDomains));
console.log("\nTop local parts:");
console.table(topCounts(senderLocals));

// --- 3. Duplicates (idempotency check) ------------------------------------
section(3, "Duplicates by message_id / event_id (idempotency check)");
function duplicates(ids: string[]): { value: string; count: number }[] {
  return [...countBy(ids).entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}
const emailDupes = duplicates(data.emails.map((e) => e.message_id));
const eventDupes = duplicates(data.calendar_events.map((e) => e.event_id));
console.log(`Duplicate message_id groups: ${emailDupes.length}`);
if (emailDupes.length) console.table(emailDupes);
console.log(`Duplicate event_id groups: ${eventDupes.length}`);
if (eventDupes.length) console.table(eventDupes);

// --- 4. Key finding: noreply@yunoai.io is not internal noise --------------
section(4, `Key finding: noreply@${YUNO_DOMAIN} is a structural trap, not noise`);
const noreplyAddress = `noreply@${YUNO_DOMAIN}`;
const noreplyEmails = data.emails.filter((e) => e.from === noreplyAddress);
const noreplyAllInternal = noreplyEmails.filter(
  (e) => e.to.every(isYunoAddress) && e.cc.every(isYunoAddress)
);
const noreplyStructuralMatch = noreplyEmails.filter((e) => WEBSITE_LEAD_BODY_PATTERN.test(e.body));

const allParticipantsYuno = data.emails.filter(
  (e) => isYunoAddress(e.from) && e.to.every(isYunoAddress) && e.cc.every(isYunoAddress)
);
const genuinelyInternal = allParticipantsYuno.filter((e) => !WEBSITE_LEAD_BODY_PATTERN.test(e.body));

console.log(`Emails from ${noreplyAddress}: ${noreplyEmails.length}`);
console.log(
  `  ...of those, sent only to/cc ${YUNO_DOMAIN} addresses (100% internal by envelope): ${noreplyAllInternal.length}`
);
console.log(
  `  ...of those, body matches the website-lead structural template (Nome:/Email:/Azienda:/UTM source:): ${noreplyStructuralMatch.length}`
);
console.log(
  `\nAll-Yuno-participants emails (from/to/cc all on ${YUNO_DOMAIN}): ${allParticipantsYuno.length}`
);
console.log(`  ...of those, genuinely internal (no structural lead template in body): ${genuinelyInternal.length}`);
console.log(
  `  ...of those, actually website leads misidentified as internal by envelope alone: ${
    allParticipantsYuno.length - genuinelyInternal.length
  }`
);
console.log(
  `\nConclusion: a naive "sender is noreply@ -> noise" or "all participants internal -> internal" rule` +
    ` would have discarded ${noreplyEmails.length} genuine website demo requests.`
);
console.log("\nSample record:");
console.log(noreplyEmails[0]);

// --- 5. Auto-reply emails --------------------------------------------------
section(5, "Auto-reply emails (subject pattern)");
const autoReplies = data.emails.filter((e) =>
  AUTO_REPLY_SUBJECT_PATTERNS.some((pattern) => pattern.test(e.subject.trim()))
);
console.log(`Auto-reply emails found: ${autoReplies.length}`);
console.table(autoReplies.map((e) => ({ from: e.from, subject: e.subject })));

// --- 6. External bulk senders ----------------------------------------------
section(6, "External bulk senders (noreply/newsletter/events/billing/notifications, non-Yuno domain)");
const bulkSenders = data.emails.filter((e) => {
  const { local, domain } = splitEmail(e.from);
  return domain !== YUNO_DOMAIN && BULK_LOCAL_PARTS.includes(local.toLowerCase());
});
console.log(`External bulk emails found: ${bulkSenders.length}`);
console.log("\nBy domain:");
console.table(topCounts(bulkSenders.map((e) => splitEmail(e.from).domain), 20));
console.log("\nBy local part:");
console.table(topCounts(bulkSenders.map((e) => splitEmail(e.from).local), 20));

// DECISIONS.md §3 claims 27 records for this rule, including linkedin.com.
// The literal BULK_LOCAL_PARTS list above does not match linkedin.com's
// "no-reply@" (hyphenated) sender — surfacing that gap here rather than
// silently widening the constant, since that's a rule-design call, not a
// script concern.
const hyphenatedNoReply = data.emails.filter((e) => {
  const { local, domain } = splitEmail(e.from);
  return domain !== YUNO_DOMAIN && local.toLowerCase() === "no-reply";
});
if (hyphenatedNoReply.length > 0) {
  console.log(
    `\nNote: DECISIONS.md §3 claims 27 records for this rule (this run found ${bulkSenders.length}).` +
      ` The gap is ${hyphenatedNoReply.length} "no-reply@" (hyphenated) sender(s), e.g. ${
        hyphenatedNoReply[0]?.from ?? "n/a"
      } — not covered by the literal local-part list above.`
  );
}

// --- 7. Personal-domain senders (quarantine candidates) --------------------
section(7, "Personal-domain senders (quarantine candidates)");
const personalDomainSenders = data.emails.filter((e) =>
  PERSONAL_DOMAINS.includes(splitEmail(e.from).domain)
);
console.log(
  `Personal-domain senders found: ${personalDomainSenders.length} (domains checked: ${PERSONAL_DOMAINS.join(", ")})`
);
console.table(personalDomainSenders.map((e) => ({ from: e.from, subject: e.subject })));

// --- 8. Calendar event status ----------------------------------------------
section(8, "Calendar event status distribution");
console.table(topCounts(data.calendar_events.map((e) => e.status)));

const cancelledEvents = data.calendar_events.filter((e) => e.status === "cancelled");
const tentativeEvents = data.calendar_events.filter((e) => e.status === "tentative");

console.log(`\nCancelled events (${cancelledEvents.length}):`);
console.table(cancelledEvents.map((e) => ({ title: e.title, start: e.start })));

console.log(`\nTentative events (${tentativeEvents.length}):`);
console.table(tentativeEvents.map((e) => ({ title: e.title, start: e.start })));

// --- 9. Top subject templates (funnel-stage signals) -----------------------
section(9, "Top subject templates (normalized Re:/Fwd:, funnel-stage signals)");
function normalizeSubject(subject: string): string {
  let normalized = subject.trim();
  const prefixPattern = /^(re|r|fwd|fw)\s*:\s*/i;
  while (prefixPattern.test(normalized)) {
    normalized = normalized.replace(prefixPattern, "").trim();
  }
  return normalized;
}
const normalizedSubjects = data.emails.map((e) => normalizeSubject(e.subject));
console.table(topCounts(normalizedSubjects, 15));

console.log("\nDone.");

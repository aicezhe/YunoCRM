import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyRow,
  emptyContext,
  type CalendarPayload,
  type ClassificationContext,
  type EmailPayload,
  type RawEventRow,
} from "./classification-rules";

// All fixtures below are real records read straight from the seed dataset —
// per project policy, classification tests must exercise the actual trap
// cases in the data, not invented stand-ins.
const DATA_PATH = join(process.cwd(), "data", "yuno-crm-seed-data.json");
const seed: { emails: EmailPayload[]; calendar_events: CalendarPayload[] } = JSON.parse(
  readFileSync(DATA_PATH, "utf-8")
);

function mustFindEmail(predicate: (e: EmailPayload) => boolean, description: string): EmailPayload {
  const found = seed.emails.find(predicate);
  if (!found) throw new Error(`Fixture email not found in seed data: ${description}`);
  return found;
}

function mustFindEmails(predicate: (e: EmailPayload) => boolean, description: string): EmailPayload[] {
  const found = seed.emails.filter(predicate);
  if (found.length === 0) throw new Error(`Fixture emails not found in seed data: ${description}`);
  return found;
}

function mustFindEvent(predicate: (e: CalendarPayload) => boolean, description: string): CalendarPayload {
  const found = seed.calendar_events.find(predicate);
  if (!found) throw new Error(`Fixture calendar event not found in seed data: ${description}`);
  return found;
}

let nextId = 1;
function emailRow(payload: EmailPayload): RawEventRow {
  return { id: `test-email-${nextId++}`, source: "email", externalId: payload.message_id, payload, status: "pending" };
}
function eventRow(payload: CalendarPayload): RawEventRow {
  return { id: `test-event-${nextId++}`, source: "calendar", externalId: payload.event_id, payload, status: "pending" };
}

describe("duplicate", () => {
  // Real duplicate: this message_id appears twice in the raw dataset.
  const [first, second] = mustFindEmails(
    (e) => e.message_id === "<52d8e05d43d8407f@mail.gmail.com>",
    "duplicate message_id <52d8e05d43d8407f@mail.gmail.com>"
  );

  it("ignores the second delivery of an already-seen external_id", () => {
    const ctx = emptyContext();
    ctx.duplicateKeys.add(`email:${second.message_id}`);
    const { outcome, matchedRule } = classifyRow(emailRow(second), ctx);
    expect(outcome).toBe("ignored");
    expect(matchedRule).toBe("duplicate");
  });

  it("does not flag the first delivery of that same external_id as a duplicate", () => {
    // duplicateKeys is empty here — mirrors how classify.ts's buildContext
    // only marks a key once a second occurrence is seen in the pending batch.
    const { matchedRule } = classifyRow(emailRow(first), emptyContext());
    expect(matchedRule).not.toBe("duplicate");
  });
});

describe("website_lead", () => {
  // The central trap from DECISIONS.md §2.1: sender AND all recipients are
  // on yunoai.io, sender local-part is "noreply" — every naive rule would
  // discard this as internal noise. It is actually a website demo request.
  const lead = mustFindEmail(
    (e) => e.from === "noreply@yunoai.io" && /Nome:/.test(e.body),
    "noreply@yunoai.io website-lead email"
  );

  it("REGRESSION: classifies the noreply@yunoai.io structural trap as processed, not ignored", () => {
    const { outcome } = classifyRow(emailRow(lead), emptyContext());
    expect(outcome).toBe("processed");
  });

  it("attributes the noreply@yunoai.io trap specifically to the website_lead rule", () => {
    const { matchedRule } = classifyRow(emailRow(lead), emptyContext());
    expect(matchedRule).toBe("website_lead");
  });
});

describe("auto_reply", () => {
  const reply = mustFindEmail(
    (e) => /^Risposta automatica:/i.test(e.subject),
    'subject starting with "Risposta automatica:"'
  );

  it("ignores a subject starting with Risposta automatica:", () => {
    const { outcome, matchedRule } = classifyRow(emailRow(reply), emptyContext());
    expect(outcome).toBe("ignored");
    expect(matchedRule).toBe("auto_reply");
  });
});

describe("external_bulk", () => {
  const githubNotice = mustFindEmail((e) => e.from === "noreply@github.com", "noreply@github.com bulk email");

  it("ignores an external noreply@ sender (github.com)", () => {
    const { outcome, matchedRule } = classifyRow(emailRow(githubNotice), emptyContext());
    expect(outcome).toBe("ignored");
    expect(matchedRule).toBe("external_bulk");
  });

  const linkedinNotice = mustFindEmail((e) => e.from === "no-reply@linkedin.com", "no-reply@linkedin.com bulk email");

  it("also ignores the hyphenated no-reply@ variant (linkedin.com)", () => {
    // Real gap found while exploring the data: DECISIONS.md's own count (27
    // records, including linkedin.com) only adds up if "no-reply" and
    // "noreply" are treated as the same local part — see normalizeLocalPart.
    const { outcome, matchedRule } = classifyRow(emailRow(linkedinNotice), emptyContext());
    expect(outcome).toBe("ignored");
    expect(matchedRule).toBe("external_bulk");
  });
});

describe("recruiting", () => {
  const jobAd = mustFindEmail(
    (e) => e.from === "recruiting@bigconsulting.com",
    "recruiting@bigconsulting.com job advert"
  );

  it("ignores a careers pitch from a recruiting@ role account", () => {
    // Found in a data audit: these three messages were reaching
    // default_processed, which made resolve.ts create a bigconsulting.com
    // company and a Lead prospect — a job ad sitting in the sales funnel.
    const { outcome, matchedRule } = classifyRow(emailRow(jobAd), emptyContext());
    expect(outcome).toBe("ignored");
    expect(matchedRule).toBe("recruiting");
  });

  it("still lets a real sales thread through when the subject is not a job pitch", () => {
    // The rule needs BOTH a hiring role account and a careers subject, so a
    // prospect whose contact happens to sit in HR is not silently dropped.
    const businessSubject: EmailPayload = { ...jobAd, subject: "Proposta commerciale Yuno — Big Consulting" };
    const { outcome } = classifyRow(emailRow(businessSubject), emptyContext());
    expect(outcome).not.toBe("ignored");
  });

  it("does not fire on a Yuno sender even with a careers subject", () => {
    const internalHire: EmailPayload = { ...jobAd, from: "hr@yunoai.io", to: ["giulia@yunoai.io"], cc: [] };
    const { matchedRule } = classifyRow(emailRow(internalHire), emptyContext());
    expect(matchedRule).not.toBe("recruiting");
  });
});

describe("internal_email", () => {
  const internal = mustFindEmail((e) => e.subject === "budget infra Q3", 'internal email "budget infra Q3"');

  it("ignores an email where every participant is on yunoai.io", () => {
    const { outcome, matchedRule } = classifyRow(emailRow(internal), emptyContext());
    expect(outcome).toBe("ignored");
    expect(matchedRule).toBe("internal_email");
  });
});

describe("cancelled_event", () => {
  // Real reschedule: cancelled, then a later confirmed "Demo Yuno x Quantum
  // Advisors" for the same company (DECISIONS.md §3.1).
  const cancelled = mustFindEvent(
    (e) => e.title === "Demo Yuno x Quantum Advisors" && e.status === "cancelled",
    "cancelled Demo Yuno x Quantum Advisors"
  );
  const laterDemo = mustFindEvent(
    (e) => e.title === "Demo Yuno x Quantum Advisors" && e.status !== "cancelled",
    "later confirmed Demo Yuno x Quantum Advisors"
  );

  it("classifies a cancelled event with a later same-company event as a reschedule", () => {
    const ctx = emptyContext();
    ctx.calendarEvents = [cancelled, laterDemo].map((e) => ({
      externalId: e.event_id,
      title: e.title,
      start: e.start,
    }));
    const { outcome, matchedRule } = classifyRow(eventRow(cancelled), ctx);
    expect(outcome).toBe("ignored");
    expect(matchedRule).toBe("cancelled_event:reschedule");
  });

  it("classifies a cancelled event with no later same-company event as a final cancellation", () => {
    // In the current dataset every one of the 7 cancelled events happens to
    // have a same-company reschedule (see explore.ts findings — this looks
    // like a gap in DECISIONS.md §3.1's "6 of 7" count, not in this rule).
    // So this test takes a real cancelled row but deliberately narrows the
    // context to isolate the "no reschedule found" branch of the predicate.
    const ctx = emptyContext();
    ctx.calendarEvents = [{ externalId: cancelled.event_id, title: cancelled.title, start: cancelled.start }];
    const { outcome, matchedRule } = classifyRow(eventRow(cancelled), ctx);
    expect(outcome).toBe("ignored");
    expect(matchedRule).toBe("cancelled_event:final");
  });
});

describe("known_contact / known_domain", () => {
  // Real external correspondent — a genuine business reply, not noise.
  const knownSenderEmail = mustFindEmail(
    (e) => e.from === "stefano.costa@quantumadvisors.eu" && e.subject.includes("Proposta commerciale"),
    "stefano.costa@quantumadvisors.eu proposal reply"
  );

  it("processes an email via known_contact when the sender's address is already a known contact", () => {
    const ctx = emptyContext();
    ctx.knownContactEmails.add("stefano.costa@quantumadvisors.eu");
    const { outcome, matchedRule } = classifyRow(emailRow(knownSenderEmail), ctx);
    expect(outcome).toBe("processed");
    expect(matchedRule).toBe("known_contact");
  });

  const knownDomainEmail = mustFindEmail(
    (e) => e.from === "anna.deluca@quantumadvisors.eu",
    "anna.deluca@quantumadvisors.eu email"
  );

  it("processes an email via known_domain when the sender's domain matches an existing company", () => {
    const ctx = emptyContext();
    ctx.knownCompanyDomains.add("quantumadvisors.eu");
    const { outcome, matchedRule } = classifyRow(emailRow(knownDomainEmail), ctx);
    expect(outcome).toBe("processed");
    expect(matchedRule).toBe("known_domain");
  });
});

describe("personal_domain", () => {
  const personal = mustFindEmail((e) => e.from === "andrea.romano@libero.it", "andrea.romano@libero.it email");

  it("quarantines a sender on a personal/consumer domain", () => {
    const { outcome, matchedRule } = classifyRow(emailRow(personal), emptyContext());
    expect(outcome).toBe("quarantined");
    expect(matchedRule).toBe("personal_domain");
  });
});

describe("unresolved", () => {
  const malformed = mustFindEvent(
    (e) => e.status === "tentative",
    "the one tentative/malformed calendar event"
  );

  it("quarantines a record that matches no other rule", () => {
    const { outcome, matchedRule } = classifyRow(eventRow(malformed), emptyContext());
    expect(outcome).toBe("quarantined");
    expect(matchedRule).toBe("unresolved");
  });
});

describe("rule priority order", () => {
  const trap = mustFindEmail(
    (e) => e.from === "noreply@yunoai.io" && /Nome:/.test(e.body),
    "noreply@yunoai.io website-lead email"
  );

  it("resolves a record matching both website_lead and internal_email as website_lead (higher priority)", () => {
    // `trap` has from/to entirely on yunoai.io (would match internal_email)
    // AND a structural lead body (matches website_lead, priority 2 vs 5).
    const { matchedRule } = classifyRow(emailRow(trap), emptyContext());
    expect(matchedRule).toBe("website_lead");
  });

  it("resolves a duplicate as ignored even when its content would otherwise match website_lead", () => {
    const ctx = emptyContext();
    ctx.duplicateKeys.add(`email:${trap.message_id}`);
    const { outcome, matchedRule } = classifyRow(emailRow(trap), ctx);
    expect(outcome).toBe("ignored");
    expect(matchedRule).toBe("duplicate");
  });
});

describe("classifyRow determinism (idempotency of the pure logic)", () => {
  // classify.ts's real-world idempotency also depends on its DB query
  // (`WHERE status = 'pending'`), which was verified manually against the
  // live Supabase project: running `npm run classify` twice in a row
  // processed 538 records once, then 0 the second time, with no duplicate
  // quarantine_items. That DB-level behavior isn't exercised here — this
  // test covers the piece Vitest can check without a live database: that
  // classifyRow itself is a pure function with no hidden state.
  const trap = mustFindEmail(
    (e) => e.from === "noreply@yunoai.io" && /Nome:/.test(e.body),
    "noreply@yunoai.io website-lead email"
  );

  it("returns the same result when called twice with the same row and context", () => {
    const ctx = emptyContext();
    const row = emailRow(trap);
    const first = classifyRow(row, ctx);
    const second = classifyRow(row, ctx);
    expect(second).toEqual(first);
  });

  it("does not mutate the input row or context", () => {
    const ctx = emptyContext();
    const row = emailRow(trap);
    const rowSnapshot = JSON.stringify(row);
    classifyRow(row, ctx);
    expect(JSON.stringify(row)).toBe(rowSnapshot);
    expect(ctx.duplicateKeys.size).toBe(0);
    expect(ctx.knownContactEmails.size).toBe(0);
  });
});

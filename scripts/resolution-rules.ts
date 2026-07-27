/**
 * Pure resolution logic — how a processed raw_event maps to domain objects
 * (company, contact, prospect channel, interaction direction, funnel-stage
 * signal). No I/O, no DB import, so it can be unit-tested in isolation;
 * scripts/resolve.ts pairs this with the actual database read/write loop.
 *
 * Signal patterns come from DECISIONS.md §4 (channels) and §5 (funnel
 * stages) and were verified against the actual dataset before being
 * encoded here — every regex below matches real records, not assumptions.
 */

import {
  isYunoAddress,
  splitEmail,
  YUNO_DOMAIN,
  type CalendarPayload,
  type EmailPayload,
} from "./classification-rules";

// Funnel stages in enum order (migration 0002). Index = position in the
// funnel; a transition is only recorded when moving to a HIGHER index
// (forward-only), and Won/Lost are terminal.
export const STAGE_ORDER = [
  "Lead",
  "Contacted",
  "Demo Scheduled",
  "Demo Done",
  "Trial",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export type FunnelStage = (typeof STAGE_ORDER)[number];

export type Channel =
  | "website"
  | "linkedin_outbound"
  | "referral"
  | "event"
  | "content_inbound"
  | "manual";

export function stageIndex(stage: FunnelStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function isTerminal(stage: FunnelStage): boolean {
  return stage === "Won" || stage === "Lost";
}

export function stripReplyPrefixes(subject: string): string {
  let normalized = subject.trim();
  const prefixPattern = /^(re|r|fwd|fw)\s*:\s*/i;
  while (prefixPattern.test(normalized)) {
    normalized = normalized.replace(prefixPattern, "").trim();
  }
  return normalized;
}

// --- Website lead parsing (DECISIONS.md §2.1) ------------------------------

export interface WebsiteLead {
  name: string | null;
  email: string;
  company: string | null;
  utmSource: string | null;
}

/** Parses the structured body of a website demo request. Returns null when the body has no Email: field (not a usable lead). */
export function parseWebsiteLead(body: string): WebsiteLead | null {
  const email = body.match(/Email:\s*(\S+)/)?.[1] ?? null;
  if (!email) return null;
  return {
    name: body.match(/Nome:\s*(.+)/)?.[1]?.trim() ?? null,
    email,
    company: body.match(/Azienda:\s*(.+)/)?.[1]?.trim() ?? null,
    utmSource: body.match(/UTM source:\s*(\S+)/)?.[1] ?? null,
  };
}

export function isWebsiteLeadEmail(email: EmailPayload): boolean {
  return email.from === `noreply@${YUNO_DOMAIN}` && parseWebsiteLead(email.body) !== null;
}

// --- Company name extraction ----------------------------------------------

/**
 * Pulls the company name out of the dataset's templated subjects.
 * Ordered from most to least specific; all patterns verified against data.
 */
export function companyNameFromSubject(subject: string): string | null {
  const s = stripReplyPrefixes(subject);
  const patterns = [
    /^richiesta demo Yuno — (.+)$/,
    /^Recap demo \+ prossimi passi — Yuno x (.+)$/,
    /^Proposta commerciale Yuno — (.+)$/,
    /^Esito valutazione — (.+)$/,
    /^Benvenuti a bordo! — Onboarding Yuno x (.+)$/,
    /^Intro: (.+)$/,
    /^Yuno x (.+?) — deal origination.*$/,
    /^Yuno x (.+)$/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

/** Body-level fallbacks: "Lavoro in {Company} (..." (content inbound), "demo dedicata per {Company}." (event follow-up). */
export function companyNameFromBody(body: string): string | null {
  const lavoro = body.match(/Lavoro in (.+?) \(/);
  if (lavoro) return lavoro[1].trim();
  const dedicata = body.match(/demo dedicata per (.+?)\./);
  if (dedicata) return dedicata[1].trim();
  return null;
}

// --- Calendar title parsing ------------------------------------------------

export type EventKind = "demo" | "trial_checkin" | "negotiation_call" | "onboarding_kickoff";

export interface ParsedEventTitle {
  kind: EventKind;
  company: string;
}

/** Parses the dataset's templated event titles; null for internal/malformed ones. */
export function parseEventTitle(title: string): ParsedEventTitle | null {
  let m = title.match(/^Demo Yuno x (.+)$/);
  if (m) return { kind: "demo", company: m[1].trim() };
  m = title.match(/^Check-in trial\s*[—-]\s*(.+)$/);
  if (m) return { kind: "trial_checkin", company: m[1].trim() };
  m = title.match(/^Call commerciale \/ contratto\s*[—-]\s*(.+)$/);
  if (m) return { kind: "negotiation_call", company: m[1].trim() };
  m = title.match(/^Kick-off onboarding\s*[—-]\s*(.+)$/);
  if (m) return { kind: "onboarding_kickoff", company: m[1].trim() };
  return null;
}

/** Stage signal carried by a confirmed calendar event (DECISIONS.md §5). Kick-off is post-Won onboarding — no stage signal. */
export function eventStageSignal(kind: EventKind): FunnelStage | null {
  switch (kind) {
    case "demo":
      return "Demo Scheduled";
    case "trial_checkin":
      return "Trial";
    case "negotiation_call":
      return "Negotiation";
    case "onboarding_kickoff":
      return null;
  }
}

// --- Email direction -------------------------------------------------------

/**
 * outbound = a Yuno human wrote to the prospect; inbound = the prospect
 * (or the website form acting on their behalf) wrote to Yuno.
 */
export function emailDirection(email: EmailPayload): "inbound" | "outbound" {
  if (isWebsiteLeadEmail(email)) return "inbound";
  return isYunoAddress(email.from) ? "outbound" : "inbound";
}

// --- Funnel stage signals from emails (DECISIONS.md §5) --------------------

export interface EmailStageSignal {
  stage: FunnelStage;
  lostReason: string | null;
}

/**
 * Canonical lost reasons (DECISIONS.md §5 lists exactly these three), keyed
 * by body patterns verified against all 6 "Esito valutazione" emails.
 * Falls back to the raw body so a Lost prospect never ends up reason-less
 * (the DB CHECK constraint would reject that).
 */
export function extractLostReason(body: string): string {
  if (/giustificare il costo/i.test(body)) return "cost not justifiable for a small team";
  if (/anno fiscale|budget .{0,20}chiuso/i.test(body)) return "budget closed until the next fiscal year";
  if (/mercato tedesco/i.test(body)) return "insufficient coverage of the German market";
  return body.trim().slice(0, 200);
}

/**
 * Highest-priority signal wins (a "Re: Proposta..." reply whose body says
 * "contratto firmato" is a Won signal, not a Negotiation one). Returns null
 * when the email carries no stage information.
 */
export function emailStageSignal(email: EmailPayload): EmailStageSignal | null {
  const subject = stripReplyPrefixes(email.subject);

  if (/contratto firmato/i.test(email.body) || /^Benvenuti a bordo!/i.test(subject)) {
    return { stage: "Won", lostReason: null };
  }
  if (/^Esito valutazione/i.test(subject)) {
    return { stage: "Lost", lostReason: extractLostReason(email.body) };
  }
  if (/^Proposta commerciale Yuno/i.test(subject)) {
    return { stage: "Negotiation", lostReason: null };
  }
  if (/^Recap demo \+ prossimi passi/i.test(subject)) {
    return { stage: "Demo Done", lostReason: null };
  }
  // Any outbound email from a Yuno human is at minimum a Contacted signal —
  // this uniformly covers all the outreach templates in the data (cold
  // outbound "Yuno x ...", post-fair "Piacere di averla conosciuta",
  // replies to website/webinar/report inquiries).
  if (emailDirection(email) === "outbound") {
    return { stage: "Contacted", lostReason: null };
  }
  return null;
}

// --- Channel attribution (DECISIONS.md §4) ---------------------------------

export interface ChannelAttribution {
  channel: Channel;
  utmSource: string | null;
}

/**
 * Channel is decided by the record that FIRST creates the prospect
 * (records are processed chronologically). Verified against the data:
 * cold outbound "Yuno x {company}" is sent by Luca, Sara AND Giulia, so the
 * signal is the template itself, not Luca's address specifically — DECISIONS
 * §4 names Luca as the archetypal sender, but restricting to him would leave
 * 20 outbound-originated prospects unattributable, contradicting §4's own
 * "all five channels are recoverable" claim.
 */
export function channelForFirstTouch(record: { email?: EmailPayload; event?: CalendarPayload }): ChannelAttribution {
  if (record.email) {
    const email = record.email;
    const subject = stripReplyPrefixes(email.subject);
    const lead = isWebsiteLeadEmail(email) ? parseWebsiteLead(email.body) : null;
    if (lead) return { channel: "website", utmSource: lead.utmSource };
    if (/^Intro: /.test(subject)) return { channel: "referral", utmSource: null };
    if (/^Piacere di averla conosciuta/i.test(subject)) return { channel: "event", utmSource: null };
    if (/^(Domanda dopo il webinar|Info su Yuno dopo il vostro report)/i.test(subject)) {
      return { channel: "content_inbound", utmSource: null };
    }
    if (/^Yuno x /.test(subject) && isYunoAddress(email.from)) {
      return { channel: "linkedin_outbound", utmSource: null };
    }
  }
  // Calendar-first prospects or emails with no recognizable template:
  // no attribution signal exists — 'manual' is the honest fallback.
  return { channel: "manual", utmSource: null };
}

// --- Participants ----------------------------------------------------------

export function externalParticipants(email: EmailPayload): string[] {
  return [email.from, ...email.to, ...email.cc].filter((a) => !isYunoAddress(a));
}

export function externalAttendees(event: CalendarPayload): string[] {
  return event.attendees.filter((a) => !isYunoAddress(a));
}

/** "cristina.caruso" -> "Cristina Caruso" — display-name fallback when no better source exists. */
export function nameFromEmailLocal(address: string): string {
  const { local } = splitEmail(address);
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Referral emails introduce the person in the body: "ti presento in copia {Name} di {Company}". */
export function referralContactName(body: string): string | null {
  return body.match(/ti presento in copia (.+?) di /)?.[1]?.trim() ?? null;
}

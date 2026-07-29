/**
 * Resolution — the step after classify.ts.
 *
 * Takes raw_events classified as 'processed' and turns them into domain
 * objects: companies, contacts, prospects, interactions, stage_transitions
 * and follow-up tasks. Also picks up rows classify.ts marked
 * 'cancelled_event:reschedule' — those are ignored for stage purposes but
 * logged as note-interactions so the reschedule shows up in the prospect's
 * timeline (DECISIONS.md §3.1).
 *
 * Performance model (brief: tens of thousands of prospects must not
 * degrade): no per-record queries — all existing companies/contacts/
 * prospects/interactions are loaded ONCE into in-memory Maps keyed by their
 * UNIQUE columns (companies.domain, contacts.email, interactions'
 * raw_event_id), new rows accumulate in arrays and are inserted in batches
 * at the end. UUIDs are generated client-side so FKs are known before any
 * insert happens.
 *
 * Idempotency: a raw_event that already has an interaction (matched by
 * interactions.raw_event_id) is skipped entirely, so re-running creates no
 * duplicate companies/interactions/transitions; follow-up tasks are skipped
 * when an automation task with the same prospect+reason already exists.
 *
 * Run: npm run resolve
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, inArray, or } from "drizzle-orm";
import { db, client } from "../src/db";
import {
  companies,
  contacts,
  interactions,
  prospects,
  rawEvents,
  stageTransitions,
  tasks,
  users,
} from "../drizzle/schema";
import { isYunoAddress, splitEmail, type CalendarPayload, type EmailPayload } from "./classification-rules";
import {
  channelForFirstTouch,
  companyNameFromBody,
  cleanCompanyName,
  companyNameFromSubject,
  isPlaceholderCompanyName,
  emailDirection,
  emailStageSignal,
  eventStageSignal,
  externalAttendees,
  externalParticipants,
  isTerminal,
  isWebsiteLeadEmail,
  nameFromEmailLocal,
  parseEventTitle,
  parseWebsiteLead,
  referralContactName,
  stageIndex,
  stripReplyPrefixes,
  type FunnelStage,
} from "./resolution-rules";

const FOLLOW_UP_DAYS = 7;
const DATA_PATH = join(process.cwd(), "data", "yuno-crm-seed-data.json");

interface CompanyRec {
  id: string;
  name: string;
  domain: string | null;
  isNew: boolean;
  /** Existing row whose placeholder name a later message replaced. */
  renamed?: boolean;
}
interface ContactRec {
  id: string;
  companyId: string;
  email: string;
  name: string | null;
  isNew: boolean;
}
interface ProspectRec {
  id: string;
  companyId: string;
  ownerId: string | null;
  channel: string;
  utmSource: string | null;
  currentStage: FunnelStage;
  lostReason: string | null;
  createdAt: string;
  isNew: boolean;
}
interface InteractionRec {
  id: string;
  prospectId: string;
  contactId: string | null;
  rawEventId: string;
  threadId: string | null;
  type: "email" | "meeting" | "note";
  direction: "inbound" | "outbound" | null;
  occurredAt: string;
  subject: string | null;
  body: string | null;
  yunoActor: string | null; // in-memory only, for follow-up assignee — not a DB column
}
interface TransitionRec {
  id: string;
  prospectId: string;
  fromStage: FunnelStage | null;
  toStage: FunnelStage;
  occurredAt: string;
  note: string | null;
}

function epoch(ts: string): number {
  return new Date(ts).getTime();
}

async function insertChunked<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>, chunkSize = 200): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await insert(rows.slice(i, i + chunkSize));
  }
}

async function main() {
  // ---- 1. Seed team users from the dataset's team block ------------------
  // The team roster isn't part of raw_events (it's workspace metadata, not
  // an inbox record) — in a real integration this would come from the user
  // directory. Idempotent via users.email UNIQUE.
  const seed = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as {
    team: { name: string; email: string; role: string }[];
  };
  const existingUsers = await db.select().from(users);
  const userIdByEmail = new Map<string, string>(existingUsers.map((u) => [u.email, u.id]));
  const newUsers = seed.team
    .filter((m) => !userIdByEmail.has(m.email))
    .map((m) => ({
      id: randomUUID(),
      email: m.email,
      name: m.name,
      role: m.role.includes("CEO") ? ("admin" as const) : ("member" as const),
    }));
  for (const u of newUsers) userIdByEmail.set(u.email, u.id);

  // ---- 2. Load everything needed into memory, once -----------------------
  const [companyRows, contactRows, prospectRows, interactionRows, taskRows, resolvable] = await Promise.all([
    db.select().from(companies),
    db.select().from(contacts),
    db.select().from(prospects),
    db.select({ rawEventId: interactions.rawEventId }).from(interactions),
    db.select({ prospectId: tasks.prospectId, reason: tasks.reason }).from(tasks).where(eq(tasks.createdBy, "automation")),
    db
      .select()
      .from(rawEvents)
      .where(or(eq(rawEvents.status, "processed"), eq(rawEvents.matchedRule, "cancelled_event:reschedule"))),
  ]);

  const companyByDomain = new Map<string, CompanyRec>();
  const companyById = new Map<string, CompanyRec>();
  for (const c of companyRows) {
    const rec: CompanyRec = { id: c.id, name: c.name, domain: c.domain, isNew: false };
    if (c.domain) companyByDomain.set(c.domain, rec);
    companyById.set(c.id, rec);
  }
  const contactByEmail = new Map<string, ContactRec>(
    contactRows.map((c) => [c.email, { id: c.id, companyId: c.companyId, email: c.email, name: c.name, isNew: false }])
  );
  const prospectByCompany = new Map<string, ProspectRec>(
    prospectRows.map((p) => [
      p.companyId,
      {
        id: p.id,
        companyId: p.companyId,
        ownerId: p.ownerId,
        channel: p.channel,
        utmSource: p.utmSource,
        currentStage: p.currentStage as FunnelStage,
        lostReason: p.lostReason,
        createdAt: p.createdAt,
        isNew: false,
      },
    ])
  );
  const resolvedRawEventIds = new Set(interactionRows.map((i) => i.rawEventId).filter((id): id is string => id !== null));
  const existingAutoTasks = new Set(taskRows.map((t) => `${t.prospectId}:${t.reason}`));

  // ---- 3. Process chronologically ----------------------------------------
  const sorted = resolvable
    .map((row) => {
      const ts = row.source === "email" ? (row.payload as EmailPayload).timestamp : (row.payload as CalendarPayload).start;
      return { row, ts };
    })
    .sort((a, b) => epoch(a.ts) - epoch(b.ts));

  const newInteractions: InteractionRec[] = [];
  const newTransitions: TransitionRec[] = [];
  let skippedAlreadyResolved = 0;
  let skippedNoCounterparty = 0;

  /**
   * Events are processed oldest-first, so the first message from a domain
   * decides the company name — and that message often carries no name at
   * all, leaving the company called after its domain. When a later message
   * does reveal a real name, it replaces that placeholder instead of being
   * discarded (audit found borsalab.io / capitalgate.eu stuck this way).
   */
  function getOrCreateCompany(domain: string, name: string | null, ts: string): CompanyRec {
    const clean = name ? cleanCompanyName(name) : null;
    const existing = companyByDomain.get(domain);
    if (existing) {
      if (clean && isPlaceholderCompanyName(existing.name, existing.domain)) {
        existing.name = clean;
        existing.renamed = true;
      }
      return existing;
    }
    const rec: CompanyRec = { id: randomUUID(), name: clean ?? domain, domain, isNew: true };
    companyByDomain.set(domain, rec);
    companyById.set(rec.id, rec);
    return rec;
  }

  function getOrCreateContact(email: string, companyId: string, name: string | null): ContactRec {
    const existing = contactByEmail.get(email);
    if (existing) return existing;
    const rec: ContactRec = { id: randomUUID(), companyId, email, name: name ?? nameFromEmailLocal(email), isNew: true };
    contactByEmail.set(email, rec);
    return rec;
  }

  function getOrCreateProspect(
    company: CompanyRec,
    firstTouch: { email?: EmailPayload; event?: CalendarPayload },
    ownerId: string | null,
    ts: string
  ): ProspectRec {
    const existing = prospectByCompany.get(company.id);
    if (existing) return existing;
    const { channel, utmSource } = channelForFirstTouch(firstTouch);
    const rec: ProspectRec = {
      id: randomUUID(),
      companyId: company.id,
      ownerId,
      channel,
      utmSource,
      currentStage: "Lead",
      lostReason: null,
      createdAt: ts,
      isNew: true,
    };
    prospectByCompany.set(company.id, rec);
    newTransitions.push({
      id: randomUUID(),
      prospectId: rec.id,
      fromStage: null,
      toStage: "Lead",
      occurredAt: ts,
      note: `prospect created via ${channel}`,
    });
    return rec;
  }

  function advanceStage(prospect: ProspectRec, to: FunnelStage, ts: string, lostReason: string | null, note: string | null) {
    if (isTerminal(prospect.currentStage)) return;
    if (stageIndex(to) <= stageIndex(prospect.currentStage)) return;
    newTransitions.push({
      id: randomUUID(),
      prospectId: prospect.id,
      fromStage: prospect.currentStage,
      toStage: to,
      occurredAt: ts,
      note,
    });
    prospect.currentStage = to;
    if (to === "Lost" && lostReason) prospect.lostReason = lostReason;
  }

  for (const { row, ts } of sorted) {
    if (resolvedRawEventIds.has(row.id)) {
      skippedAlreadyResolved++;
      continue;
    }

    if (row.source === "email") {
      const email = row.payload as EmailPayload;
      const subject = stripReplyPrefixes(email.subject);
      const direction = emailDirection(email);

      // Figure out the counterparty (company + contact) for this email.
      let contactEmail: string | null = null;
      let contactName: string | null = null;
      let companyName: string | null = companyNameFromSubject(email.subject) ?? companyNameFromBody(email.body);

      if (isWebsiteLeadEmail(email)) {
        const lead = parseWebsiteLead(email.body)!;
        contactEmail = lead.email;
        contactName = lead.name;
        companyName = lead.company ?? companyName;
      } else if (/^Intro: /.test(email.subject) && email.cc.some((a) => !isYunoAddress(a))) {
        // Referral: only the ORIGINAL Intro email (no Re: prefix — checked
        // on the raw subject deliberately). The prospect is the person being
        // introduced (in cc), NOT the referrer who sent the email. Replies
        // ("Re: Intro: ...") cc the referrer instead, so they must fall
        // through to the normal inbound/outbound branches below.
        contactEmail = email.cc.find((a) => !isYunoAddress(a))!;
        contactName = referralContactName(email.body);
      } else if (direction === "inbound") {
        contactEmail = email.from;
      } else {
        contactEmail = email.to.find((a) => !isYunoAddress(a)) ?? externalParticipants(email)[0] ?? null;
      }

      if (!contactEmail) {
        skippedNoCounterparty++;
        continue;
      }

      const domain = splitEmail(contactEmail).domain;
      const company = getOrCreateCompany(domain, companyName, ts);
      const contact = getOrCreateContact(contactEmail, company.id, contactName);

      const yunoActor =
        direction === "outbound" && !isWebsiteLeadEmail(email)
          ? email.from
          : email.to.find((a) => userIdByEmail.has(a)) ?? null;
      const ownerId = yunoActor ? userIdByEmail.get(yunoActor) ?? null : null;
      const prospect = getOrCreateProspect(company, { email }, ownerId, ts);

      newInteractions.push({
        id: randomUUID(),
        prospectId: prospect.id,
        contactId: contact.id,
        rawEventId: row.id,
        threadId: email.thread_id,
        type: "email",
        direction,
        occurredAt: ts,
        subject: email.subject,
        body: email.body,
        yunoActor,
      });

      const signal = emailStageSignal(email);
      if (signal) advanceStage(prospect, signal.stage, ts, signal.lostReason, `email: ${subject.slice(0, 80)}`);
    } else {
      const event = row.payload as CalendarPayload;
      const parsed = parseEventTitle(event.title);
      const extAttendee = externalAttendees(event)[0] ?? null;
      if (!extAttendee && !parsed) {
        skippedNoCounterparty++;
        continue;
      }

      // Prefer the external attendee's domain (robust); title only names it.
      const domain = extAttendee ? splitEmail(extAttendee).domain : null;
      const company = domain
        ? getOrCreateCompany(domain, parsed?.company ?? null, ts)
        : [...companyByDomain.values()].find((c) => c.name === parsed!.company) ?? null;
      if (!company) {
        skippedNoCounterparty++;
        continue;
      }
      const contact = extAttendee ? getOrCreateContact(extAttendee, company.id, null) : null;
      const organizerId = userIdByEmail.get(event.organizer) ?? null;
      const prospect = getOrCreateProspect(company, { event }, organizerId, ts);

      const isReschedule = row.matchedRule === "cancelled_event:reschedule";
      newInteractions.push({
        id: randomUUID(),
        prospectId: prospect.id,
        contactId: contact?.id ?? null,
        rawEventId: row.id,
        threadId: null,
        type: isReschedule ? "note" : "meeting",
        direction: isReschedule ? null : "outbound",
        occurredAt: ts,
        subject: isReschedule ? `Rescheduled: ${event.title}` : event.title,
        body: event.description || null,
        yunoActor: event.organizer,
      });

      // Reschedules never touch the stage (DECISIONS.md §3.1); confirmed
      // events advance it per their template kind.
      if (!isReschedule && parsed) {
        const stage = eventStageSignal(parsed.kind);
        if (stage) advanceStage(prospect, stage, ts, null, `event: ${event.title.slice(0, 80)}`);
      }
    }
  }

  // ---- 4. Follow-up tasks (separate pass, after all interactions known) --
  // "No reply in N days" is evaluated as of the end of the observed period
  // (max interaction timestamp), not the wall clock — the dataset ends
  // 2026-07-09, so wall-clock "now" would mark every prospect stale.
  const interactionsByProspect = new Map<string, InteractionRec[]>();
  for (const i of newInteractions) {
    const list = interactionsByProspect.get(i.prospectId) ?? [];
    list.push(i);
    interactionsByProspect.set(i.prospectId, list);
  }
  const referenceNow = newInteractions.length
    ? Math.max(...newInteractions.map((i) => epoch(i.occurredAt)))
    : Date.now();

  const newTasks: {
    id: string;
    prospectId: string;
    assigneeId: string | null;
    title: string;
    dueDate: string;
    reason: string;
    createdBy: "automation";
  }[] = [];
  const followUpReason = `no reply in ${FOLLOW_UP_DAYS} days`;

  for (const [prospectId, list] of interactionsByProspect) {
    const prospect = [...prospectByCompany.values()].find((p) => p.id === prospectId)!;
    if (isTerminal(prospect.currentStage)) continue;
    if (existingAutoTasks.has(`${prospectId}:${followUpReason}`)) continue;

    const sortedInteractions = [...list].sort((a, b) => epoch(a.occurredAt) - epoch(b.occurredAt));
    const last = sortedInteractions[sortedInteractions.length - 1];
    if (last.direction !== "outbound") continue;
    const daysSince = (referenceNow - epoch(last.occurredAt)) / (24 * 3600 * 1000);
    if (daysSince <= FOLLOW_UP_DAYS) continue;

    const company = companyById.get(prospect.companyId)!;
    const dueDate = new Date(epoch(last.occurredAt) + FOLLOW_UP_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 10);
    newTasks.push({
      id: randomUUID(),
      prospectId,
      assigneeId: (last.yunoActor ? userIdByEmail.get(last.yunoActor) : null) ?? prospect.ownerId,
      title: `Follow up with ${company.name}`,
      dueDate,
      reason: followUpReason,
      createdBy: "automation",
    });
  }

  // ---- 5. Batch inserts, FK order ----------------------------------------
  const newCompanies = [...companyById.values()].filter((c) => c.isNew);
  const newContacts = [...contactByEmail.values()].filter((c) => c.isNew);
  const newProspects = [...prospectByCompany.values()].filter((p) => p.isNew);
  // Global chronological order so the current_stage sync trigger fires in
  // funnel order per prospect and the last transition really is the latest.
  newTransitions.sort((a, b) => epoch(a.occurredAt) - epoch(b.occurredAt));

  if (newUsers.length) await db.insert(users).values(newUsers).onConflictDoNothing({ target: users.email });
  await insertChunked(newCompanies, (chunk) =>
    db
      .insert(companies)
      .values(chunk.map((c) => ({ id: c.id, name: c.name, domain: c.domain })))
      .onConflictDoNothing({ target: companies.domain })
  );
  // Placeholder names replaced by a real one found in a later message. Only
  // ever upgrades domain-shaped placeholders, so a name a human set by hand
  // through the quarantine screen is never overwritten.
  const renamedCompanies = [...companyById.values()].filter((c) => !c.isNew && c.renamed);
  for (const c of renamedCompanies) {
    await db.update(companies).set({ name: c.name }).where(eq(companies.id, c.id));
  }
  await insertChunked(newContacts, (chunk) =>
    db
      .insert(contacts)
      .values(chunk.map((c) => ({ id: c.id, companyId: c.companyId, email: c.email, name: c.name })))
      .onConflictDoNothing({ target: contacts.email })
  );
  await insertChunked(newProspects, (chunk) =>
    db.insert(prospects).values(
      chunk.map((p) => ({
        id: p.id,
        companyId: p.companyId,
        ownerId: p.ownerId,
        channel: p.channel as "website" | "linkedin_outbound" | "referral" | "event" | "content_inbound" | "manual",
        utmSource: p.utmSource,
        lostReason: p.lostReason,
        createdAt: p.createdAt,
      }))
    )
  );
  await insertChunked(newInteractions, (chunk) =>
    db.insert(interactions).values(
      chunk.map((i) => ({
        id: i.id,
        prospectId: i.prospectId,
        contactId: i.contactId,
        rawEventId: i.rawEventId,
        threadId: i.threadId,
        type: i.type,
        direction: i.direction,
        occurredAt: i.occurredAt,
        subject: i.subject,
        body: i.body,
        createdBy: "automation" as const,
      }))
    )
  );
  await insertChunked(newTransitions, (chunk) =>
    db.insert(stageTransitions).values(
      chunk.map((t) => ({
        id: t.id,
        prospectId: t.prospectId,
        fromStage: t.fromStage,
        toStage: t.toStage,
        occurredAt: t.occurredAt,
        actorType: "automation" as const,
        note: t.note,
      }))
    )
  );
  if (newTasks.length) await insertChunked(newTasks, (chunk) => db.insert(tasks).values(chunk));

  // ---- 6. Summary --------------------------------------------------------
  console.log("\n=== Resolution summary ===");
  console.log(`Raw events considered: ${resolvable.length} (processed + cancelled-reschedules)`);
  console.log(`  skipped, already resolved on a previous run: ${skippedAlreadyResolved}`);
  console.log(`  skipped, no external counterparty:           ${skippedNoCounterparty}`);
  console.table([
    { entity: "users", created: newUsers.length },
    { entity: "companies", created: newCompanies.length },
    { entity: "contacts", created: newContacts.length },
    { entity: "prospects", created: newProspects.length },
    { entity: "interactions", created: newInteractions.length },
    { entity: "stage_transitions", created: newTransitions.length },
    { entity: "tasks (follow-up)", created: newTasks.length },
  ]);

  if (renamedCompanies.length) {
    console.log(`\nCompanies renamed off a domain placeholder: ${renamedCompanies.length}`);
    for (const c of renamedCompanies) console.log(`  ${c.domain} -> "${c.name}"`);
  }

  const stageCounts = new Map<string, number>();
  for (const p of prospectByCompany.values()) {
    stageCounts.set(p.currentStage, (stageCounts.get(p.currentStage) ?? 0) + 1);
  }
  console.log("\nProspects by final stage (in-memory):");
  console.table([...stageCounts.entries()].sort((a, b) => b[1] - a[1]).map(([stage, count]) => ({ stage, count })));

  const channelCounts = new Map<string, number>();
  for (const p of prospectByCompany.values()) {
    channelCounts.set(p.channel, (channelCounts.get(p.channel) ?? 0) + 1);
  }
  console.log("\nProspects by channel:");
  console.table([...channelCounts.entries()].sort((a, b) => b[1] - a[1]).map(([channel, count]) => ({ channel, count })));
}

main()
  .catch((err) => {
    console.error("Resolution failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });

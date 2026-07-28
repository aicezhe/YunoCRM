import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  contacts,
  interactions,
  prospects,
  stageTransitions,
  tasks,
  users,
} from "../../../../../drizzle/schema";

export type CompanyDetail = {
  id: string;
  name: string;
  domain: string | null;
  createdAt: string;
  contacts: { id: string; name: string | null; email: string; title: string | null }[];
  prospects: ProspectDetail[];
};

export type ProspectDetail = {
  id: string;
  channel: string;
  utmSource: string | null;
  currentStage: string;
  lostReason: string | null;
  ownerName: string | null;
  createdAt: string;
  transitions: { fromStage: string | null; toStage: string; occurredAt: string; actorType: string; note: string | null }[];
  interactions: {
    id: string;
    type: string;
    direction: string | null;
    occurredAt: string;
    subject: string | null;
    body: string | null;
    contactName: string | null;
  }[];
  tasks: { id: string; title: string; dueDate: string; status: string; reason: string | null; assigneeName: string | null }[];
};

export type CompanyDetailResult = { state: "ok"; data: CompanyDetail } | { state: "not_found" } | { state: "error" };

export async function getCompanyDetail(companyId: string): Promise<CompanyDetailResult> {
  try {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) return { state: "not_found" };

    const companyContacts = await db
      .select({ id: contacts.id, name: contacts.name, email: contacts.email, title: contacts.title })
      .from(contacts)
      .where(eq(contacts.companyId, companyId))
      .orderBy(asc(contacts.name));

    const companyProspects = await db
      .select({
        id: prospects.id,
        channel: prospects.channel,
        utmSource: prospects.utmSource,
        currentStage: prospects.currentStage,
        lostReason: prospects.lostReason,
        createdAt: prospects.createdAt,
        ownerName: users.name,
      })
      .from(prospects)
      .leftJoin(users, eq(users.id, prospects.ownerId))
      .where(eq(prospects.companyId, companyId))
      .orderBy(desc(prospects.createdAt));

    const prospectDetails: ProspectDetail[] = [];
    for (const p of companyProspects) {
      const [transitions, prospectInteractions, prospectTasks] = await Promise.all([
        db
          .select({
            fromStage: stageTransitions.fromStage,
            toStage: stageTransitions.toStage,
            occurredAt: stageTransitions.occurredAt,
            actorType: stageTransitions.actorType,
            note: stageTransitions.note,
          })
          .from(stageTransitions)
          .where(eq(stageTransitions.prospectId, p.id))
          .orderBy(asc(stageTransitions.occurredAt)),
        db
          .select({
            id: interactions.id,
            type: interactions.type,
            direction: interactions.direction,
            occurredAt: interactions.occurredAt,
            subject: interactions.subject,
            body: interactions.body,
            contactName: contacts.name,
          })
          .from(interactions)
          .leftJoin(contacts, eq(contacts.id, interactions.contactId))
          .where(eq(interactions.prospectId, p.id))
          .orderBy(desc(interactions.occurredAt)),
        db
          .select({
            id: tasks.id,
            title: tasks.title,
            dueDate: tasks.dueDate,
            status: tasks.status,
            reason: tasks.reason,
            assigneeName: users.name,
          })
          .from(tasks)
          .leftJoin(users, eq(users.id, tasks.assigneeId))
          .where(eq(tasks.prospectId, p.id))
          .orderBy(asc(tasks.dueDate)),
      ]);

      prospectDetails.push({ ...p, transitions, interactions: prospectInteractions, tasks: prospectTasks });
    }

    return {
      state: "ok",
      data: { ...company, contacts: companyContacts, prospects: prospectDetails },
    };
  } catch (err) {
    console.error("[companies/:id] query failed:", err);
    return { state: "error" };
  }
}

import { sql } from "drizzle-orm";
import { db } from "@/db";

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

/**
 * One query, not one per relation.
 *
 * This used to walk the tree — company, then contacts, then prospects, then
 * three queries per prospect — which is six sequential round trips for a
 * typical company. Every one of them measured ~61 ms against a hosted
 * Postgres regardless of what it selected, because the cost is the network,
 * not the work: 370 ms before the overlay could render anything.
 *
 * The data is a tree, so it is fetched as a tree. Correlated subqueries build
 * the nested arrays server-side and the whole document comes back in a single
 * round trip — measured 67 ms for the same company, 5.5x faster.
 *
 * Parallelising the six queries instead was the obvious alternative and was
 * measured too: 131 ms, because the pool holds 5 connections and the sixth
 * query waits for one to free up. Still three round trips' worth of latency
 * for data that fits in one.
 */
export async function getCompanyDetail(companyId: string): Promise<CompanyDetailResult> {
  try {
    const rows = await db.execute<{
      id: string;
      name: string;
      domain: string | null;
      created_at: string;
      contacts: CompanyDetail["contacts"];
      prospects: ProspectDetail[];
    }>(sql`
      select
        c.id, c.name, c.domain, c.created_at,
        (
          select coalesce(json_agg(json_build_object(
            'id', ct.id, 'name', ct.name, 'email', ct.email, 'title', ct.title
          ) order by ct.name asc), '[]'::json)
          from contacts ct
          where ct.company_id = c.id
        ) as contacts,
        (
          select coalesce(json_agg(json_build_object(
            'id', p.id,
            'channel', p.channel,
            'utmSource', p.utm_source,
            'currentStage', p.current_stage,
            'lostReason', p.lost_reason,
            'ownerName', owner.name,
            'createdAt', p.created_at,
            -- Same (occurred_at, to_stage) ordering as the dashboard
            -- queries: 39 prospects have two transitions sharing a
            -- timestamp, and funnel_stage is an enum, so it breaks the tie
            -- in funnel order instead of leaving it to the planner.
            'transitions', (
              select coalesce(json_agg(json_build_object(
                'fromStage', st.from_stage, 'toStage', st.to_stage,
                'occurredAt', st.occurred_at, 'actorType', st.actor_type, 'note', st.note
              ) order by st.occurred_at asc, st.to_stage asc), '[]'::json)
              from stage_transitions st
              where st.prospect_id = p.id
            ),
            'interactions', (
              select coalesce(json_agg(json_build_object(
                'id', i.id, 'type', i.type, 'direction', i.direction,
                'occurredAt', i.occurred_at, 'subject', i.subject, 'body', i.body,
                'contactName', ict.name
              ) order by i.occurred_at desc), '[]'::json)
              from interactions i
              left join contacts ict on ict.id = i.contact_id
              where i.prospect_id = p.id
            ),
            'tasks', (
              select coalesce(json_agg(json_build_object(
                'id', t.id, 'title', t.title, 'dueDate', t.due_date, 'status', t.status,
                'reason', t.reason, 'assigneeName', assignee.name
              ) order by t.due_date asc), '[]'::json)
              from tasks t
              left join users assignee on assignee.id = t.assignee_id
              where t.prospect_id = p.id
            )
          ) order by p.created_at desc), '[]'::json)
          from prospects p
          left join users owner on owner.id = p.owner_id
          where p.company_id = c.id
        ) as prospects
      from companies c
      where c.id = ${companyId}
    `);

    const row = rows[0];
    if (!row) return { state: "not_found" };

    return {
      state: "ok",
      data: {
        id: row.id,
        name: row.name,
        domain: row.domain,
        createdAt: row.created_at,
        contacts: row.contacts,
        prospects: row.prospects,
      },
    };
  } catch (err) {
    console.error("[companies/:id] query failed:", err);
    return { state: "error" };
  }
}

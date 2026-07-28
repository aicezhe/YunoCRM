import { pgTable, index, unique, uuid, text, timestamp, vector, foreignKey, check, date, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const channelType = pgEnum("channel_type", ['website', 'linkedin_outbound', 'referral', 'event', 'content_inbound', 'manual'])
export const funnelStage = pgEnum("funnel_stage", ['Lead', 'Contacted', 'Demo Scheduled', 'Demo Done', 'Trial', 'Negotiation', 'Won', 'Lost'])
export const interactionDirection = pgEnum("interaction_direction", ['inbound', 'outbound'])
export const interactionType = pgEnum("interaction_type", ['email', 'call', 'meeting', 'note'])


export const companies = pgTable("companies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	domain: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	embedding: vector({ dimensions: 512 }),
}, (table) => [
	index("idx_companies_embedding_cosine").using("ivfflat", table.embedding.asc().nullsLast().op("vector_cosine_ops")).with({lists: "100"}),
	index("idx_companies_name_trgm").using("gin", table.name.asc().nullsLast().op("gin_trgm_ops")),
	unique("companies_domain_key").on(table.domain),
]);

export const prospects = pgTable("prospects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	ownerId: uuid("owner_id"),
	channel: channelType().notNull(),
	utmSource: text("utm_source"),
	currentStage: funnelStage("current_stage").default('Lead').notNull(),
	lostReason: text("lost_reason"),
	lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_prospects_current_stage").using("btree", table.currentStage.asc().nullsLast().op("enum_ops")),
	index("idx_prospects_last_interaction").using("btree", table.lastInteractionAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_prospects_owner").using("btree", table.ownerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "prospects_company_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "prospects_owner_id_fkey"
		}).onDelete("set null"),
	check("lost_requires_reason", sql`(current_stage <> 'Lost'::funnel_stage) OR (lost_reason IS NOT NULL)`),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	name: text().notNull(),
	role: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_key").on(table.email),
	check("users_role_check", sql`role = ANY (ARRAY['admin'::text, 'member'::text])`),
]);

export const contacts = pgTable("contacts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	email: text().notNull(),
	name: text(),
	title: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "contacts_company_id_fkey"
		}).onDelete("restrict"),
	unique("contacts_email_key").on(table.email),
]);

export const stageTransitions = pgTable("stage_transitions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	prospectId: uuid("prospect_id").notNull(),
	fromStage: funnelStage("from_stage"),
	toStage: funnelStage("to_stage").notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).notNull(),
	actorType: text("actor_type").notNull(),
	actorId: uuid("actor_id"),
	note: text(),
}, (table) => [
	index("idx_stage_transitions_prospect").using("btree", table.prospectId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_stage_transitions_to_stage").using("btree", table.toStage.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [users.id],
			name: "stage_transitions_actor_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.prospectId],
			foreignColumns: [prospects.id],
			name: "stage_transitions_prospect_id_fkey"
		}).onDelete("cascade"),
	check("stage_transitions_actor_type_check", sql`actor_type = ANY (ARRAY['human'::text, 'automation'::text])`),
]);

export const interactions = pgTable("interactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	prospectId: uuid("prospect_id").notNull(),
	contactId: uuid("contact_id"),
	rawEventId: uuid("raw_event_id"),
	threadId: text("thread_id"),
	type: interactionType().notNull(),
	direction: interactionDirection(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).notNull(),
	subject: text(),
	body: text(),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_interactions_prospect").using("btree", table.prospectId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "interactions_contact_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.prospectId],
			foreignColumns: [prospects.id],
			name: "interactions_prospect_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.rawEventId],
			foreignColumns: [rawEvents.id],
			name: "interactions_raw_event_id_fkey"
		}).onDelete("set null"),
	check("interactions_created_by_check", sql`created_by = ANY (ARRAY['human'::text, 'automation'::text])`),
]);

export const tasks = pgTable("tasks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	prospectId: uuid("prospect_id").notNull(),
	assigneeId: uuid("assignee_id"),
	title: text().notNull(),
	dueDate: date("due_date").notNull(),
	status: text().default('open').notNull(),
	reason: text(),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tasks_assignee_status").using("btree", table.assigneeId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.assigneeId],
			foreignColumns: [users.id],
			name: "tasks_assignee_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.prospectId],
			foreignColumns: [prospects.id],
			name: "tasks_prospect_id_fkey"
		}).onDelete("cascade"),
	check("tasks_created_by_check", sql`created_by = ANY (ARRAY['human'::text, 'automation'::text])`),
	check("tasks_status_check", sql`status = ANY (ARRAY['open'::text, 'done'::text, 'dismissed'::text])`),
]);

export const rawEvents = pgTable("raw_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	source: text().notNull(),
	externalId: text("external_id").notNull(),
	payload: jsonb().notNull(),
	status: text().default('pending').notNull(),
	matchedRule: text("matched_rule"),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_raw_events_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	unique("raw_events_external_id_unique").on(table.source, table.externalId),
	check("raw_events_source_check", sql`source = ANY (ARRAY['email'::text, 'calendar'::text])`),
	check("raw_events_status_check", sql`status = ANY (ARRAY['pending'::text, 'ignored'::text, 'processed'::text, 'quarantined'::text, 'failed'::text])`),
]);

export const quarantineItems = pgTable("quarantine_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	rawEventId: uuid("raw_event_id").notNull(),
	reason: text().notNull(),
	suggestedAction: jsonb("suggested_action"),
	candidates: jsonb(),
	status: text().default('open').notNull(),
	resolvedBy: uuid("resolved_by"),
	resolution: text(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_quarantine_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.rawEventId],
			foreignColumns: [rawEvents.id],
			name: "quarantine_items_raw_event_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [users.id],
			name: "quarantine_items_resolved_by_fkey"
		}).onDelete("set null"),
	check("quarantine_items_status_check", sql`status = ANY (ARRAY['open'::text, 'resolved'::text])`),
]);

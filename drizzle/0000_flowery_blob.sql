-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."channel_type" AS ENUM('website', 'linkedin_outbound', 'referral', 'event', 'content_inbound', 'manual');--> statement-breakpoint
CREATE TYPE "public"."funnel_stage" AS ENUM('Lead', 'Contacted', 'Demo Scheduled', 'Demo Done', 'Trial', 'Negotiation', 'Won', 'Lost');--> statement-breakpoint
CREATE TYPE "public"."interaction_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('email', 'call', 'meeting', 'note');--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"owner_id" uuid,
	"channel" "channel_type" NOT NULL,
	"utm_source" text,
	"current_stage" "funnel_stage" DEFAULT 'Lead' NOT NULL,
	"lost_reason" text,
	"last_interaction_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lost_requires_reason" CHECK ((current_stage <> 'Lost'::funnel_stage) OR (lost_reason IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK (role = ANY (ARRAY['admin'::text, 'member'::text]))
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_domain_key" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "stage_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"from_stage" "funnel_stage",
	"to_stage" "funnel_stage" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"note" text,
	CONSTRAINT "stage_transitions_actor_type_check" CHECK (actor_type = ANY (ARRAY['human'::text, 'automation'::text]))
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"contact_id" uuid,
	"raw_event_id" uuid,
	"thread_id" text,
	"type" "interaction_type" NOT NULL,
	"direction" "interaction_direction",
	"occurred_at" timestamp with time zone NOT NULL,
	"subject" text,
	"body" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interactions_created_by_check" CHECK (created_by = ANY (ARRAY['human'::text, 'automation'::text]))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"assignee_id" uuid,
	"title" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_created_by_check" CHECK (created_by = ANY (ARRAY['human'::text, 'automation'::text])),
	CONSTRAINT "tasks_status_check" CHECK (status = ANY (ARRAY['open'::text, 'done'::text, 'dismissed'::text]))
);
--> statement-breakpoint
CREATE TABLE "raw_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"matched_rule" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raw_events_external_id_unique" UNIQUE("source","external_id"),
	CONSTRAINT "raw_events_source_check" CHECK (source = ANY (ARRAY['email'::text, 'calendar'::text])),
	CONSTRAINT "raw_events_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'ignored'::text, 'processed'::text, 'quarantined'::text, 'failed'::text]))
);
--> statement-breakpoint
CREATE TABLE "quarantine_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_event_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"suggested_action" jsonb,
	"candidates" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quarantine_items_status_check" CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text]))
);
--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_raw_event_id_fkey" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarantine_items" ADD CONSTRAINT "quarantine_items_raw_event_id_fkey" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarantine_items" ADD CONSTRAINT "quarantine_items_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_prospects_current_stage" ON "prospects" USING btree ("current_stage" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_prospects_last_interaction" ON "prospects" USING btree ("last_interaction_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_prospects_owner" ON "prospects" USING btree ("owner_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_stage_transitions_prospect" ON "stage_transitions" USING btree ("prospect_id" timestamptz_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_stage_transitions_to_stage" ON "stage_transitions" USING btree ("to_stage" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_interactions_prospect" ON "interactions" USING btree ("prospect_id" timestamptz_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_tasks_assignee_status" ON "tasks" USING btree ("assignee_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_raw_events_status" ON "raw_events" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_quarantine_status" ON "quarantine_items" USING btree ("status" text_ops);
*/
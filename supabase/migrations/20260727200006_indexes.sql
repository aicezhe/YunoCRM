-- 0006_indexes.sql
-- Every index here is tied to a specific query from the brief (dashboard
-- questions, prospect list/detail, ingestion resolver) — not added
-- speculatively. Each comment states which query it serves.

-- Dashboard: "how is the pipeline distributed across stages today?"
create index idx_prospects_current_stage on prospects (current_stage);

-- Prospect list: "my prospects" view, filtered by owner.
create index idx_prospects_owner on prospects (owner_id);

-- Dashboard: "which prospects have gone cold?" — range scan on a timestamp,
-- needs an index to avoid a full table scan at tens of thousands of rows.
create index idx_prospects_last_interaction on prospects (last_interaction_at);

-- Ingestion resolver: matching an incoming email's sender domain to an
-- existing company. (companies.domain is already UNIQUE, which Postgres
-- backs with an index automatically — no extra index needed here.)

-- Prospect detail page: "all stage transitions for this prospect, in order."
create index idx_stage_transitions_prospect on stage_transitions (prospect_id, occurred_at);

-- Dashboard: "average time spent in each stage" — grouping/scanning by stage
-- across all prospects.
create index idx_stage_transitions_to_stage on stage_transitions (to_stage);

-- Prospect detail page: "interaction timeline for this prospect, newest first."
create index idx_interactions_prospect on interactions (prospect_id, occurred_at desc);

-- Ingestion resolver: matching a contact's email to an existing contact.
-- (contacts.email is already UNIQUE — indexed automatically.)

-- Open tasks list / "my tasks" view.
create index idx_tasks_assignee_status on tasks (assignee_id, status);

-- Ingestion pipeline: fetching the next batch of unprocessed raw_events.
create index idx_raw_events_status on raw_events (status);

-- Quarantine screen: open items to review.
create index idx_quarantine_status on quarantine_items (status);

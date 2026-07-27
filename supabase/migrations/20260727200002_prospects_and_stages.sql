-- 0002_prospects_and_stages.sql
-- The heart of the system: the prospect lifecycle and its full history.
-- This is the table set the take-home brief says will be evaluated most deeply.

create type funnel_stage as enum (
  'Lead',
  'Contacted',
  'Demo Scheduled',
  'Demo Done',
  'Trial',
  'Negotiation',
  'Won',
  'Lost'
);
-- A Postgres ENUM, not a free-text column: the funnel is a fixed, known set
-- of stages defined by the brief. An ENUM makes invalid stage values
-- impossible at the database level, not just checked in application code.

create type channel_type as enum (
  'website',
  'linkedin_outbound',
  'referral',
  'event',
  'content_inbound',
  'manual'
);
-- The five channels found in the dataset (see DECISIONS.md §4), plus
-- 'manual' for prospects created directly by a user rather than ingestion.

create table prospects (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete restrict,
  owner_id            uuid references users(id) on delete set null,
  -- ON DELETE SET NULL: if a team member leaves, their prospects don't
  -- disappear or block deletion — they become unassigned and reassignable.
  channel             channel_type not null,
  utm_source          text,
  -- Kept separate from `channel`: channel is the 5 top-level buckets used
  -- by the dashboard; utm_source (e.g. 'google_ads') is finer-grained
  -- attribution captured from website lead emails, for drill-down later.
  current_stage       funnel_stage not null default 'Lead',
  lost_reason         text,
  last_interaction_at timestamptz,
  created_at          timestamptz not null default now(),

  constraint lost_requires_reason
    check (current_stage <> 'Lost' or lost_reason is not null)
  -- Enforced by the database, not just the UI form: a prospect cannot be
  -- marked Lost without a reason, full stop. This directly satisfies the
  -- brief's "a lost prospect must have a lost reason."
);

comment on column prospects.current_stage is
  'Denormalized snapshot of the latest stage, kept in sync with '
  'stage_transitions by a trigger (see 0006). Source of truth is '
  'stage_transitions; this column exists purely so the dashboard and list '
  'views can query prospects directly without joining/aggregating history '
  'on every page load — required at the stated scale of tens of thousands '
  'of prospects.';

create table stage_transitions (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references prospects(id) on delete cascade,
  -- CASCADE here (unlike companies/contacts above) is deliberate: stage
  -- history has no meaning independent of its prospect. If a prospect
  -- record is ever deleted, its history should go with it.
  from_stage   funnel_stage,
  -- nullable: the very first transition has no "from" stage.
  to_stage     funnel_stage not null,
  occurred_at  timestamptz not null,
  actor_type   text not null check (actor_type in ('human', 'automation')),
  actor_id     uuid references users(id) on delete set null,
  -- null when actor_type = 'automation'.
  note         text
);

comment on table stage_transitions is
  'Full, append-only history of every stage change. This is what makes '
  '"how long do prospects spend in each stage" answerable — a single '
  'current_stage column on prospects could never answer that question.';

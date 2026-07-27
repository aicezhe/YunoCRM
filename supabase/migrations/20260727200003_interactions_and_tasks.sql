-- 0003_interactions_and_tasks.sql
-- Every touchpoint with a prospect, and the follow-ups they generate.

create type interaction_type as enum ('email', 'call', 'meeting', 'note');
create type interaction_direction as enum ('inbound', 'outbound');

create table interactions (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid not null references prospects(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  raw_event_id  uuid,
  -- FK to raw_events added in 0004 (raw_events is created after this table,
  -- see note there) — links every automated interaction back to the exact
  -- source record for full auditability ("why does this interaction exist?").
  thread_id     text,
  -- From the dataset's email thread_id: groups a back-and-forth exchange
  -- in the prospect's timeline without having to infer it from subjects.
  type          interaction_type not null,
  direction     interaction_direction,
  occurred_at   timestamptz not null,
  subject       text,
  body          text,
  created_by    text not null check (created_by in ('human', 'automation')),
  created_at    timestamptz not null default now()
);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references prospects(id) on delete cascade,
  assignee_id  uuid references users(id) on delete set null,
  title        text not null,
  due_date     date not null,
  status       text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  reason       text,
  -- e.g. 'no reply in 7 days' — why the automation created this task.
  created_by   text not null check (created_by in ('human', 'automation')),
  created_at   timestamptz not null default now()
);

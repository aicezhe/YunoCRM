-- 0004_raw_events_and_quarantine.sql
-- The staging layer. Every record from the source (currently the JSON
-- dataset, tomorrow Gmail/Calendar) lands here unmodified before any
-- classification happens. Nothing here is ever deleted — see DECISIONS.md §2.

create table raw_events (
  id             uuid primary key default gen_random_uuid(),
  source         text not null check (source in ('email', 'calendar')),
  external_id    text not null,
  -- message_id for emails, event_id for calendar events — the dataset's own
  -- stable identifiers, reused directly rather than inventing new ones.
  payload        jsonb not null,
  -- The record exactly as received. Re-running classification after a rule
  -- change never requires re-reading the source file.
  status         text not null default 'pending'
                   check (status in ('pending', 'ignored', 'processed', 'quarantined', 'failed')),
  matched_rule   text,
  -- id of the classification rule that decided the outcome (see 0005-equivalent
  -- rule registry in application code) — e.g. 'website_lead', 'auto_reply'.
  -- This is what makes "why isn't this email in the CRM?" answerable on demand.
  processed_at   timestamptz,
  created_at     timestamptz not null default now(),

  constraint raw_events_external_id_unique unique (source, external_id)
  -- This single constraint is what makes ingestion idempotent: re-running
  -- the ingest script on the same file (or receiving the same webhook twice,
  -- in a real integration) can never create a duplicate raw_event, enforced
  -- by the database rather than by an application-level "check if it exists
  -- first" query that could race.
);

-- Now that raw_events exists, attach the FK promised in 0003.
alter table interactions
  add constraint interactions_raw_event_id_fkey
  foreign key (raw_event_id) references raw_events(id) on delete set null;

create table quarantine_items (
  id              uuid primary key default gen_random_uuid(),
  raw_event_id    uuid not null references raw_events(id) on delete cascade,
  reason          text not null,
  -- e.g. 'personal_domain', 'unresolved' — which rule sent this here.
  suggested_action jsonb,
  -- e.g. { "action": "create_prospect", "company_guess": "..." } — best
  -- guess the pipeline can offer, to speed up the human decision without
  -- making it automatically.
  candidates      jsonb,
  -- e.g. possible existing companies/contacts this might match, for a
  -- "link to existing" resolution option in the UI.
  status          text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by     uuid references users(id) on delete set null,
  resolution      text,
  -- free text describing what the human decided and why, for audit.
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

comment on table quarantine_items is
  'Genuinely ambiguous raw_events routed here for a human decision. '
  'Deliberately not a dumping ground for everything unrecognised — see '
  'DECISIONS.md §2.3 on why noise is ignored outright rather than '
  'quarantined, keeping this screen small and worth a human''s attention.';

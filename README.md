# YunoCRM

A CRM built on top of a raw event feed: emails, calendar events and website form
submissions are ingested, classified, resolved into companies and prospects, and
surfaced as a pipeline an operator can actually work.

UI available in English, Italian, and Russian — added as a demonstration of
production-readiness beyond the brief's requirements.

Live demo: [yuno-crm.vercel.app](https://yuno-crm.vercel.app) (Vercel + Supabase).

## Running from scratch

Prerequisites: Node 20+, a free [Supabase](https://supabase.com) project
(hosted Postgres — nothing else from Supabase is required beyond Auth).

**1. Install and configure**

```bash
npm install
```

Create `.env.local` in the repo root (values come from your Supabase project's
Settings → Database / API):

```bash
# Postgres connection string (Direct connection, port 5432)
DATABASE_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres

# Supabase Auth (login sessions)
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-only: creating auth users

# Optional — smart (semantic) search. Without it the search screen says so
# and exact matching keeps working.
VOYAGE_API_KEY=pa-...
```

**2. Apply the schema**

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

Migrations live in `supabase/migrations/` and create all nine tables, the
enums, constraints, triggers, and indexes described under *Data model* below.

**3. Load the dataset**

The provided fixture is committed at `data/yuno-crm-seed-data.json`. The
pipeline is a chain of idempotent scripts — each safe to re-run:

```bash
npm run ingest            # raw feed -> raw_events, verbatim
npm run classify          # rule engine: process / ignore / quarantine
npm run resolve           # -> companies, contacts, prospects, interactions, stage history
npm run enrich            # resolution suggestions for quarantined items
npm run embed-companies   # optional, needs VOYAGE_API_KEY (powers smart search)
npm run seed-users        # auth accounts + roles; prints logins and the demo password
```

**4. Run**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with any
account `seed-users` printed. `seed-users` upserts by email, so re-running it
also restores roles changed through the UI.

**Tests**

```bash
npm test          # vitest — 72 tests, no database or network needed
npx tsc --noEmit  # types
npm run build     # production build
```

What the tests cover, in the brief's order of importance: the classification
rules against the fixture's planted traps (personal-domain senders that are
real leads, bulk senders, auto-replies, the ambiguous-sender cases), the
resolution rules (channel attribution, stage signals from emails and calendar
events, the canonical lost reasons, reschedule-vs-cancel), embedding-text
construction, and the display logic where locales genuinely differ (Russian
plural forms, the fractional-number grammar case, relative time). Dashboard
aggregates live in SQL; they were verified against independently written SQL
over the same database rather than unit-tested, and the pure formatting around
them is what the unit tests pin down.

## Data model

Nine tables. The short version: `raw_events` is the append-only inbox,
`quarantine_items` is its human-review queue, and everything else is the CRM
domain, with `stage_transitions` as the source of truth for funnel history.

```mermaid
erDiagram
    companies ||--o{ prospects : "restrict delete"
    companies ||--o{ contacts : "restrict delete"
    users |o--o{ prospects : "owner (set null)"
    users |o--o{ tasks : "assignee (set null)"
    users |o--o{ stage_transitions : "actor (set null)"
    users |o--o{ quarantine_items : "resolved_by (set null)"
    prospects ||--o{ interactions : "cascade"
    prospects ||--o{ stage_transitions : "cascade"
    prospects ||--o{ tasks : "cascade"
    contacts |o--o{ interactions : "set null"
    raw_events |o--o{ interactions : "provenance (set null)"
    raw_events ||--o{ quarantine_items : "cascade"

    companies {
        uuid id PK
        text name
        text domain UK
        vector embedding "512d, smart search"
    }
    prospects {
        uuid id PK
        uuid company_id FK
        uuid owner_id FK
        enum channel
        text utm_source
        enum current_stage "cached via trigger"
        text lost_reason "CHECK: required when Lost"
        timestamptz last_interaction_at "cached via trigger"
    }
    contacts {
        uuid id PK
        uuid company_id FK
        text email UK
        text name
        text title
    }
    users {
        uuid id PK
        text email UK
        text name
        text role "admin | member"
    }
    interactions {
        uuid id PK
        uuid prospect_id FK
        uuid contact_id FK
        uuid raw_event_id FK
        text thread_id
        enum type "email|call|meeting|note"
        enum direction "inbound|outbound"
        timestamptz occurred_at
        text created_by "CHECK: human|automation"
    }
    stage_transitions {
        uuid id PK
        uuid prospect_id FK
        enum from_stage "null = initial"
        enum to_stage
        timestamptz occurred_at
        text actor_type "CHECK: human|automation"
        uuid actor_id FK
    }
    tasks {
        uuid id PK
        uuid prospect_id FK
        uuid assignee_id FK
        date due_date
        text status "CHECK: open|done|dismissed"
        text created_by "CHECK: human|automation"
    }
    raw_events {
        uuid id PK
        text source "CHECK: email|calendar"
        text external_id "UK with source"
        jsonb payload "verbatim"
        text status "CHECK: pending|ignored|processed|quarantined|failed"
        text matched_rule
    }
    quarantine_items {
        uuid id PK
        uuid raw_event_id FK
        text reason
        jsonb suggested_action
        jsonb candidates
        text status "CHECK: open|resolved"
        text resolution "audit, always English"
    }
```

Decisions worth defending up front:

- **Stage history is the source of truth; `current_stage` is a cache.** Every
  stage change is a `stage_transitions` row (who/what moved it, from, to,
  when, why). A database trigger — not application code — keeps
  `prospects.current_stage` in sync on insert, so no write path can forget.
  Same pattern for `last_interaction_at`, whose trigger only ever moves the
  timestamp forward, so late-arriving events can't rewind it.
- **Integrity lives in the database.** `lost_requires_reason` (a Lost prospect
  must say why), the `actor_type`/`created_by`/`status` CHECKs, unique
  `companies.domain` and `contacts.email`, and `raw_events (source,
  external_id)` unique — which is what makes the entire ingest pipeline
  idempotent and webhook-replay-safe.
- **Deletes are deliberate.** A company with prospects can't be deleted
  (restrict); deleting a prospect takes its interactions/history/tasks with it
  (cascade); deleting a user never destroys records they touched (set null).
- **Every index is tied to a named query** — the comments in
  `supabase/migrations/20260727200006_indexes.sql` state which one. At the
  brief's reference scale (tens of thousands of prospects, hundreds of
  thousands of interactions) the hot paths are index scans: dashboard
  aggregates on `current_stage` / `last_interaction_at` / `to_stage`,
  timelines on `(prospect_id, occurred_at)`, ingest batches on
  `raw_events.status`, plus trigram on `companies.name` for search.
- **No RLS.** All database access goes through the Next.js server over
  `DATABASE_URL`; the browser only ever talks to Supabase Auth. Authorization
  is enforced server-side twice: middleware gates the routes, and the
  admin-only server actions re-check the caller's role themselves (a page
  redirect alone would not stop a member from invoking the action endpoint
  directly). RLS would add value the day the browser gets a direct database
  path; it doesn't have one.

## Real email/calendar integration

The pipeline was shaped so that swapping the JSON fixture for live sources
changes the *feeder*, not the model:

- **Ingestion is already idempotent.** `raw_events (source, external_id)` is
  unique and payloads are stored verbatim, so a webhook delivered twice, a
  replayed batch, or an overlapping backfill inserts nothing twice. Gmail:
  `users.watch` + Pub/Sub push, then `history.list` from the stored
  `historyId` cursor, fetching each new message id → one `raw_events` row per
  message (`external_id` = Gmail message id). Calendar: `events.watch`
  channels with incremental `syncToken`s, `external_id` = event id + a
  version discriminator so reschedules arrive as new events rather than
  silent mutations.
- **Push is an optimization, polling is the guarantee.** Watch channels
  expire (~7 days) and Pub/Sub can drop; a scheduled poll with the same
  cursors produces identical rows, and idempotency makes the overlap free.
- **Everything downstream is unchanged.** Classification, resolution,
  quarantine and enrichment already consume `raw_events` with a status state
  machine (`pending → processed | ignored | quarantined | failed`).
  `failed` is retryable; ambiguity goes to quarantine for a human, which is
  the same answer for a live feed as for the fixture.
- **Auth and secrets.** Per-workspace OAuth (gmail.readonly,
  calendar.events.readonly), refresh tokens server-side only; the webhook
  endpoint validates the channel token it issued. Nothing in the browser.

## Scope: cut deliberately

- **Tasks screen.** The `tasks` table, constraints and indexes exist and the
  model is ready for "book a follow-up when a prospect withers" — the screen
  itself was cut for depth elsewhere. Adding it is UI work, not model work.
- **Manual prospect/stage editing.** Records enter through the pipeline or
  through quarantine resolution; there is no hand-built "create prospect"
  form. That matches the product's thesis (the CRM that fills itself), but a
  real deployment would grow one — `stage_transitions.actor_type = 'human'`
  is already there waiting for it.
- **Segment drawer caps at 200 rows** and says so in its footer instead of
  paginating; at reference scale a single channel can exceed what anyone
  reads in a drawer.
- **Smart search degrades, never blocks.** Without `VOYAGE_API_KEY` (or
  before `embed-companies` has run) the screen states which piece is missing
  and exact search keeps working.

## Using it

### Dashboard

Four cards, each a link into a screen that answers one question:

| Card | Question it answers |
| --- | --- |
| **Source** | Where do prospects come from, and which channels convert best? |
| **By stage** | How is the pipeline distributed across stages today? |
| **Time** | How long do prospects sit in each stage, and where do they stick? |
| **Withering** | Which prospects have gone cold (no interaction for 14+ days)? |

The number on each card is the headline; the caption under it is the
denominator, so "54 · of 57 open, cold 14+ days" is readable without opening
anything.

**Recent activity** below the cards is the last five interactions across every
prospect — company, what happened (inbound/outbound email, call, meeting,
note), and when.

### Reading the charts

The two donuts on the Source screen carry two levels of detail:

- **Hover a segment** — a card with that segment's numbers: prospects, active,
  won, win rate.
- **Click a segment** — a panel slides in from the right with the same numbers
  plus every prospect behind them: company, stage, owner, last contact. Each row
  opens that company. Close with the ✕, a click outside, or `Esc`.

**On touch devices** there is no hover, so a tap goes straight to the panel —
which is why the panel repeats the summary numbers rather than assuming you
already saw the hover card. The panel enters from the bottom instead of the
side, sized so the list is thumb-reachable.

### Search

Two modes behind one toggle:

- **Off** — substring matching on company name, plus contact names and email
  addresses. A contact match resolves to that contact's company rather than
  becoming its own result, annotated with who matched.
- **Smart search** — the query is embedded and matched by meaning, so a Russian
  query like *винодельня* finds an Italian company named *Vini Colline Toscane*.

`⌘⇧F` dumps the full company list without typing anything. That shortcut is
desktop-only; below `md` the same thing is a **Show full list** button next to
Search, because a keyboard shortcut on a phone is not a feature.

### Quarantine

Events the pipeline could not resolve on its own, with the reason it gave up and
its own suggestion. Three ways out: create a new company, link to an existing
one, or discard. The badge in the navigation is the number still open.

Resolutions are written to the database in English regardless of the interface
language — an audit trail should not depend on which locale someone happened to
be using when they clicked.

### Team

Admin-only. Role changes and invitations. The last remaining admin cannot be
demoted; the screen is also protected server-side, so opening `/users` directly
as a member redirects rather than rendering.

## On how much the interface explains

Not much of this is spelled out on screen, and that is deliberate. A CRM is not
a page someone reads once — it is a tool the same few people open every morning
for months. Explanatory copy that helps on day one is noise by week two, and
noise is what makes people stop reading the screen at all.

So the interface states the numbers and keeps the fast paths available without
announcing them: hover for a peek, click for the list, a shortcut for the full
dump. Everything is reachable without knowing the shortcuts; knowing them just
makes it quicker. The explanation lives here, in the README, where it can be
read once and does not have to be scrolled past every day.

## Reading the numbers

Two things are worth knowing before the dashboard surprises you.

**Analytics are measured against the data; the activity feed is not.** The
seeded history runs 7 Jan – 9 Jul 2026. "Cold" and "days in stage" measure
distances *inside* that history, so they are anchored to the newest event in
the dataset rather than to today — otherwise every prospect would read as
stale purely because the fixture is not live. The anchor date is printed under
the greeting ("Funnel data as of …").

Recent activity is the exception, and deliberately so: it answers "what has
happened lately", and a reader takes *now* literally. Anchoring it to the data
made the newest event announce itself as just-happened when it was three weeks
old. It uses the wall clock, so on a stale fixture it honestly reads "21 days
ago" — which is itself worth knowing, since it says nothing has been ingested
in three weeks.

**Withering flags 54 of 57 open prospects, and that is correct.** The 393
seeded interactions are spread fairly evenly across those six months, with only
16 of them in the final two weeks. A 14-day window is ~8% of the history, so at
an even spread you would expect roughly 4–5 prospects to still count as warm;
there are 3. Every open prospect has at least one interaction, so none of the 54
are "never contacted". The threshold comes from the brief, and it has been left
alone rather than tuned to produce a more flattering screenshot.

## Notes

`DECISIONS.md`, cited throughout the pipeline code by section (§1–§8), is the
brief's own specification document. It is not part of this repository — the
references point back at the source of each rule so the reasoning stays
traceable.

Beyond the pipeline scripts listed under *Running from scratch*, `npm run
explore` and `npm run audit-filtering` are read-only diagnostics over the same
data.

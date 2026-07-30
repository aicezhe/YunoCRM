# YunoCRM

A CRM built on top of a raw event feed: emails, calendar events and website form
submissions are ingested, classified, resolved into companies and prospects, and
surfaced as a pipeline an operator can actually work.

UI available in English, Italian, and Russian — added as a demonstration of
production-readiness beyond the brief's requirements.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Seeded accounts share one
demo password; `npm run seed-users` prints the list and is idempotent (it
upserts by email, so re-running it also restores roles that were changed
through the UI).

Smart search additionally needs `VOYAGE_API_KEY` in the environment. Without it
the search screen says so and falls back to exact matching.

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

**Time is measured against the data, not the clock.** The seeded history runs
7 Jan – 9 Jul 2026. "Cold", "days in stage" and the relative timestamps in
Recent activity are all measured from the newest event in the dataset, not from
today — otherwise every prospect would read as stale purely because the fixture
is not live. The date this is anchored to is printed under the greeting
("Funnel data as of …").

One visible consequence: the top row of Recent activity always reads *now*,
because it *is* the reference point.

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

## Development

```bash
npm test          # vitest, pure rule logic on real fixture rows
npx tsc --noEmit  # types
npm run build     # production build
```

The ingestion pipeline is a chain of idempotent npm scripts, each safe to
re-run: `ingest` → `classify` → `resolve` → `enrich` → `embed-companies` →
`seed-users`. `explore` and `audit-filtering` are read-only diagnostics over
the same data.

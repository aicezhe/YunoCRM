import { sql } from "drizzle-orm";
import { VoyageAIClient } from "voyageai";
import { db } from "@/db";

export type SearchResultCompany = {
  kind: "company";
  id: string;
  name: string;
  domain: string | null;
  channel: string | null;
  stage: string | null;
  similarity?: number;
  /** Set when this company surfaced via a contact match rather than its
   * own name — the card still represents the company, just annotated with
   * which person matched. */
  matchedContact?: { name: string | null; email: string } | null;
};

/** The result list is always companies — a contact match still resolves to
 * its company's card (see matchedContact), never a separate top-level
 * "contact" card. */
export type SearchResult = SearchResultCompany;

export type SearchReport =
  | { state: "ok"; results: SearchResult[] }
  | { state: "empty"; query: string }
  | { state: "error" }
  /** Smart search specifically: VOYAGE_API_KEY is missing or no company has
   * been embedded yet. A setup gap, not a failure — worth saying plainly
   * instead of showing the generic "something went wrong". */
  | { state: "unconfigured"; reason: "no_api_key" | "no_embeddings" };

const RESULT_LIMIT = 50;
const ALL_COMPANIES_LIMIT = 200;

// Every company query picks the same "one prospect to represent this
// company" row: prefer whichever prospect is still open, tie-broken by the
// newest — matching scripts/embed-companies.ts so the channel/stage shown
// in a card is the same fact that went into its embedding.
const CHOSEN_PROSPECT_JOIN = sql`
  left join lateral (
    select channel, current_stage
    from prospects
    where company_id = c.id
    order by (current_stage not in ('Won', 'Lost')) desc, created_at desc
    limit 1
  ) p on true
`;

/** Escapes ILIKE wildcards so a literal `%` or `_` typed by a user searches
 * for that character instead of acting as a pattern. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => "\\" + m);
}

export async function listAllCompaniesAlphabetical(): Promise<SearchReport> {
  try {
    const rows = await db.execute<{
      id: string;
      name: string;
      domain: string | null;
      channel: string | null;
      stage: string | null;
    }>(sql`
      select c.id, c.name, c.domain, p.channel::text as channel, p.current_stage::text as stage
      from companies c
      ${CHOSEN_PROSPECT_JOIN}
      order by c.name asc
      limit ${ALL_COMPANIES_LIMIT}
    `);

    if (rows.length === 0) return { state: "empty", query: "" };
    return { state: "ok", results: rows.map((r) => ({ kind: "company" as const, ...r, matchedContact: null })) };
  } catch (err) {
    console.error("[search] list-all query failed:", err);
    return { state: "error" };
  }
}

export async function searchNormal(query: string): Promise<SearchReport> {
  try {
    const pattern = `%${escapeLike(query)}%`;

    const companyRows = await db.execute<{
      id: string;
      name: string;
      domain: string | null;
      channel: string | null;
      stage: string | null;
    }>(sql`
      select c.id, c.name, c.domain, p.channel::text as channel, p.current_stage::text as stage
      from companies c
      ${CHOSEN_PROSPECT_JOIN}
      where c.name ilike ${pattern}
      order by c.name asc
      limit ${RESULT_LIMIT}
    `);

    // Contacts never appear as their own top-level result — a matching
    // contact resolves to their company's card instead (annotated below),
    // so this joins straight through to the company.
    const contactRows = await db.execute<{
      company_id: string;
      company_name: string;
      domain: string | null;
      channel: string | null;
      stage: string | null;
      contact_name: string | null;
      contact_email: string;
    }>(sql`
      select
        c.id as company_id, c.name as company_name, c.domain,
        p.channel::text as channel, p.current_stage::text as stage,
        ct.name as contact_name, ct.email as contact_email
      from contacts ct
      join companies c on c.id = ct.company_id
      ${CHOSEN_PROSPECT_JOIN}
      where ct.name ilike ${pattern} or ct.email ilike ${pattern}
      order by ct.name asc
      limit ${RESULT_LIMIT}
    `);

    const byCompany = new Map<string, SearchResultCompany>();
    for (const r of companyRows) {
      byCompany.set(r.id, { kind: "company", ...r, matchedContact: null });
    }
    for (const r of contactRows) {
      const existing = byCompany.get(r.company_id);
      const matchedContact = { name: r.contact_name, email: r.contact_email };
      if (existing) {
        // Company already matched by name — just note the contact too,
        // without overwriting an earlier contact match.
        existing.matchedContact ??= matchedContact;
      } else {
        byCompany.set(r.company_id, {
          kind: "company",
          id: r.company_id,
          name: r.company_name,
          domain: r.domain,
          channel: r.channel,
          stage: r.stage,
          matchedContact,
        });
      }
    }

    const results = [...byCompany.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (results.length === 0) return { state: "empty", query };
    return { state: "ok", results };
  } catch (err) {
    console.error("[search] normal search failed:", err);
    return { state: "error" };
  }
}

// Cosine similarity below this is treated as noise rather than a real
// match. Voyage's raw scores haven't been observed on this dataset yet
// (embedding requires VOYAGE_API_KEY) — revisit once real query/company
// similarity scores are available.
const SMART_SIMILARITY_THRESHOLD = 0.5;
const SMART_RESULT_LIMIT = 10;
const EMBED_MODEL = "voyage-3-lite";

async function embedQuery(query: string): Promise<number[]> {
  const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
  const response = await voyage.embed({ input: query, model: EMBED_MODEL, inputType: "query" });
  const vector = response.data?.[0]?.embedding;
  if (!vector) throw new Error("Voyage returned no embedding for the search query");
  return vector;
}

/** Smart search: companies only — contacts have no descriptive text to
 * embed meaningfully, so they're left to the exact-match mode. */
export async function searchSmart(query: string): Promise<SearchReport> {
  try {
    if (!process.env.VOYAGE_API_KEY) return { state: "unconfigured", reason: "no_api_key" };

    const [{ embedded }] = await db.execute<{ embedded: number }>(
      sql`select count(*) filter (where embedding is not null)::int as embedded from companies`
    );
    if (embedded === 0) return { state: "unconfigured", reason: "no_embeddings" };

    const vector = await embedQuery(query);
    const vectorLiteral = JSON.stringify(vector);

    const rows = await db.execute<{
      id: string;
      name: string;
      domain: string | null;
      channel: string | null;
      stage: string | null;
      similarity: number;
    }>(sql`
      select
        c.id, c.name, c.domain, p.channel::text as channel, p.current_stage::text as stage,
        1 - (c.embedding <=> ${vectorLiteral}::vector) as similarity
      from companies c
      ${CHOSEN_PROSPECT_JOIN}
      where c.embedding is not null
      order by c.embedding <=> ${vectorLiteral}::vector asc
      limit ${SMART_RESULT_LIMIT}
    `);

    const matches = rows.filter((r) => r.similarity >= SMART_SIMILARITY_THRESHOLD);
    if (matches.length === 0) return { state: "empty", query };

    return { state: "ok", results: matches.map((r) => ({ kind: "company" as const, ...r, matchedContact: null })) };
  } catch (err) {
    console.error("[search] smart search failed:", err);
    return { state: "error" };
  }
}

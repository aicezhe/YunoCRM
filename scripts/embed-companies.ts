/**
 * Computes and stores companies.embedding for Smart search (/search).
 *
 * There is no "industry" field anywhere in this schema or in the seed
 * dataset, so each company's embedding text is built from what actually
 * exists: its name, domain, and its most recent/active prospect's channel
 * and funnel stage (the same "pick one prospect per company" rule the
 * search query itself uses — see src/app/(app)/search/queries.ts).
 *
 * Idempotent: only companies with embedding IS NULL are processed, so
 * re-running never re-embeds (and re-bills) companies that already have one.
 *
 * Run: npm run embed-companies   (requires VOYAGE_API_KEY in .env.local)
 */

import { VoyageAIClient } from "voyageai";
import { sql } from "drizzle-orm";
import { db, client } from "../src/db";
import { companies } from "../drizzle/schema";

const EMBED_MODEL = "voyage-3-lite";
const BATCH_SIZE = 128; // Voyage's per-request input list cap.

interface CompanyToEmbed {
  id: string;
  name: string;
  domain: string | null;
  channel: string | null;
  stage: string | null;
}

/** Same "prefer an active prospect, else the newest one" pick the search query uses. */
async function loadCompaniesWithoutEmbedding(): Promise<CompanyToEmbed[]> {
  const rows = await db.execute<{
    id: string;
    name: string;
    domain: string | null;
    channel: string | null;
    stage: string | null;
  }>(sql`
    select
      c.id,
      c.name,
      c.domain,
      p.channel::text as channel,
      p.current_stage::text as stage
    from companies c
    left join lateral (
      select channel, current_stage
      from prospects
      where company_id = c.id
      order by (current_stage not in ('Won', 'Lost')) desc, created_at desc
      limit 1
    ) p on true
    where c.embedding is null
  `);
  return rows;
}

function embeddingText(c: CompanyToEmbed): string {
  const parts = [c.name];
  if (c.domain) parts.push(c.domain);
  if (c.channel) parts.push(`${c.channel} channel`);
  if (c.stage) parts.push(`stage: ${c.stage}`);
  return parts.join(". ");
}

async function main() {
  const pending = await loadCompaniesWithoutEmbedding();
  const [{ total: totalCompanies }] = await db.execute<{ total: number }>(
    sql`select count(*)::int as total from companies`
  );

  if (pending.length === 0) {
    console.log(`Nothing to do — all ${totalCompanies} companies already have an embedding.`);
    return;
  }

  const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const texts = batch.map(embeddingText);

    try {
      const response = await voyage.embed({ input: texts, model: EMBED_MODEL, inputType: "document" });
      const vectors = response.data ?? [];
      if (vectors.length !== batch.length) {
        throw new Error(`Expected ${batch.length} embeddings back, got ${vectors.length}`);
      }

      for (let j = 0; j < batch.length; j++) {
        const embedding = vectors[j].embedding;
        if (!embedding) throw new Error(`No embedding vector for company ${batch[j].id}`);
        await db.update(companies).set({ embedding }).where(sql`${companies.id} = ${batch[j].id}`);
        embedded++;
      }
      console.log(`[embed] batch ${i / BATCH_SIZE + 1}: ${batch.length} companies embedded`);
    } catch (err) {
      failed += batch.length;
      console.error(`[embed] batch ${i / BATCH_SIZE + 1} failed, ${batch.length} companies left without an embedding —`, err);
    }
  }

  console.log("\n=== Embedding summary ===");
  console.table([
    { outcome: "companies considered", count: pending.length },
    { outcome: "embedded", count: embedded },
    { outcome: "failed (left without embedding)", count: failed },
    { outcome: "already had an embedding (skipped)", count: totalCompanies - pending.length },
  ]);
}

main()
  .catch((err) => {
    console.error("Embedding run failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });

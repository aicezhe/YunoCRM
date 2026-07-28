/**
 * Quarantine enrichment — the optional final layer of the pipeline
 * (DECISIONS.md §7). Adds resolution suggestions to open quarantine_items so
 * the human review screen starts from a suggestion instead of from zero.
 *
 * This layer is strictly additive: if it never runs or fails mid-way, the
 * core pipeline (ingest → classify → resolve) is unaffected — items simply
 * stay in quarantine without a suggestion (§7.4).
 *
 * Two tiers, cheap-first fallback (not orchestration):
 *   1. pg_trgm word_similarity against companies.name (§7.1) — DB-native,
 *      deterministic, zero-network. A match ≥ SIMILARITY_THRESHOLD is written
 *      to quarantine_items.candidates and the item never reaches the AI.
 *   2. Claude Haiku (claude-haiku-4-5) — only for items tier 1 couldn't
 *      resolve. Returns a suggested action (create / link / discard), a
 *      company guess, and a confidence indicator (§7.2), written to
 *      quarantine_items.suggested_action. A suggestion, never an autonomous
 *      write — a human still resolves the item.
 *
 * Idempotent: items that already have candidates or suggested_action are
 * skipped, so re-running never overwrites or duplicates suggestions.
 *
 * Run: npm run enrich   (requires ANTHROPIC_API_KEY in .env.local for tier 2)
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq, sql } from "drizzle-orm";
import { db, client } from "../src/db";
import { companies, quarantineItems, rawEvents } from "../drizzle/schema";
import type { CalendarPayload, EmailPayload } from "./classification-rules";

// Tunable: minimum word_similarity for a tier-1 match to count as confident.
const SIMILARITY_THRESHOLD = 0.4;
const AI_MODEL = "claude-haiku-4-5";

interface TrgmMatch {
  companyId: string;
  name: string;
  similarity: number;
}

interface AiSuggestion {
  action: "create_prospect" | "link_to_existing" | "discard";
  company_guess: string | null;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

/** The text a human (or matcher) would look at to decide what this item is. */
function extractText(source: string, payload: unknown): string {
  if (source === "email") {
    const email = payload as EmailPayload;
    return `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body}`;
  }
  const event = payload as CalendarPayload;
  return `Title: ${event.title}\nOrganizer: ${event.organizer}\nAttendees: ${event.attendees.join(", ")}\n\n${event.description}`;
}

/** Tier 1: best fuzzy match of any known company name inside the item's text. */
async function trgmBestMatch(text: string): Promise<TrgmMatch | null> {
  const rows = await db
    .select({
      companyId: companies.id,
      name: companies.name,
      similarity: sql<number>`word_similarity(${companies.name}, ${text})`,
    })
    .from(companies)
    .orderBy(sql`word_similarity(${companies.name}, ${text}) desc`)
    .limit(1);
  const best = rows[0];
  return best && best.similarity >= SIMILARITY_THRESHOLD ? best : null;
}

/** Tier 2: ask Claude Haiku for a structured resolution suggestion. */
async function aiSuggestion(
  anthropic: Anthropic,
  text: string,
  reason: string,
  companyNames: string[]
): Promise<AiSuggestion> {
  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system:
      "You are helping a CRM operator triage quarantined inbox records. " +
      "Given an ambiguous email or calendar event and the list of companies already in the CRM, " +
      "suggest ONE action: link_to_existing (the record clearly belongs to a known company), " +
      "create_prospect (a genuine business inquiry from a company not yet in the CRM), " +
      "or discard (noise with no business value). " +
      "The dataset is Italian-language B2B sales correspondence.",
    messages: [
      {
        role: "user",
        content:
          `Quarantine reason: ${reason}\n\n` +
          `Record:\n${text}\n\n` +
          `Known companies in the CRM:\n${companyNames.join("\n")}`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["create_prospect", "link_to_existing", "discard"] },
            company_guess: {
              type: ["string", "null"],
              description:
                "For link_to_existing: the exact known company name. For create_prospect: the new company's name as inferred from the record. Null for discard.",
            },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            rationale: { type: "string", description: "One or two sentences, in English." },
          },
          required: ["action", "company_guess", "confidence", "rationale"],
          additionalProperties: false,
        },
      },
    },
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error(`No text block in AI response (stop_reason: ${response.stop_reason})`);
  return JSON.parse(textBlock.text) as AiSuggestion;
}

async function main() {
  const openItems = await db
    .select({
      id: quarantineItems.id,
      reason: quarantineItems.reason,
      candidates: quarantineItems.candidates,
      suggestedAction: quarantineItems.suggestedAction,
      source: rawEvents.source,
      payload: rawEvents.payload,
    })
    .from(quarantineItems)
    .innerJoin(rawEvents, eq(rawEvents.id, quarantineItems.rawEventId))
    .where(eq(quarantineItems.status, "open"));

  const companyNames = (await db.select({ name: companies.name }).from(companies)).map((c) => c.name);

  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const anthropic = hasApiKey ? new Anthropic() : null;
  if (!hasApiKey) {
    console.log("ANTHROPIC_API_KEY not set — tier 2 (AI) disabled; only pg_trgm matches will be applied.");
  }

  let skippedAlreadyEnriched = 0;
  let trgmResolved = 0;
  let aiResolved = 0;
  let aiFailed = 0;

  for (const item of openItems) {
    if (item.candidates !== null || item.suggestedAction !== null) {
      skippedAlreadyEnriched++;
      continue;
    }

    const text = extractText(item.source, item.payload);

    // --- Tier 1: fuzzy match, always tried first -------------------------
    const match = await trgmBestMatch(text);
    if (match) {
      await db
        .update(quarantineItems)
        .set({
          candidates: {
            source: "pg_trgm",
            matches: [
              {
                company_id: match.companyId,
                name: match.name,
                similarity: Number(match.similarity.toFixed(3)),
              },
            ],
          },
        })
        .where(eq(quarantineItems.id, item.id));
      trgmResolved++;
      console.log(`[trgm ] ${item.reason}: matched "${match.name}" (similarity ${match.similarity.toFixed(3)})`);
      continue;
    }

    // --- Tier 2: AI suggestion, only when tier 1 wasn't confident --------
    if (!anthropic) continue;
    try {
      const suggestion = await aiSuggestion(anthropic, text, item.reason, companyNames);
      await db
        .update(quarantineItems)
        .set({ suggestedAction: { source: AI_MODEL, ...suggestion } })
        .where(eq(quarantineItems.id, item.id));
      aiResolved++;
      console.log(
        `[ai   ] ${item.reason}: ${suggestion.action}` +
          (suggestion.company_guess ? ` -> "${suggestion.company_guess}"` : "") +
          ` (${suggestion.confidence})`
      );
    } catch (err) {
      // §7.4: an AI failure never breaks the pipeline — the item simply
      // stays in quarantine without a suggestion.
      aiFailed++;
      console.error(`[ai   ] ${item.reason}: failed, item left without suggestion —`, err);
    }
  }

  console.log("\n=== Enrichment summary ===");
  console.table([
    { outcome: "open items considered", count: openItems.length },
    { outcome: "skipped (already enriched)", count: skippedAlreadyEnriched },
    { outcome: "tier 1: pg_trgm candidates", count: trgmResolved },
    { outcome: "tier 2: AI suggestions", count: aiResolved },
    { outcome: "tier 2: AI failures (left bare)", count: aiFailed },
  ]);
}

main()
  .catch((err) => {
    console.error("Enrichment failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });

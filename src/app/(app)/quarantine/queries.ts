import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quarantineItems, rawEvents } from "../../../../drizzle/schema";
import type { CalendarPayload, EmailPayload } from "../../../../scripts/classification-rules";

export type PgTrgmCandidate = { companyId: string; name: string; similarity: number };
export type AiSuggestion = {
  action: "create_prospect" | "link_to_existing" | "discard";
  companyGuess: string | null;
  confidence: "high" | "medium" | "low";
  rationale: string;
};

export type QuarantineDisplayItem = {
  id: string;
  /** Raw classifier rule id (e.g. "personal_domain") — translated for
   * display via the "quarantineReasons" dictionary at render time, not
   * baked into a label here, so this stays locale-agnostic. */
  reason: string;
  source: "email" | "calendar";
  subject: string;
  preview: string;
  fromLabel: string;
  occurredAt: string;
  candidates: PgTrgmCandidate[];
  suggestion: AiSuggestion | null;
};

export type QuarantineReport = { state: "ok"; items: QuarantineDisplayItem[] } | { state: "empty" } | { state: "error" };

function displayFromPayload(source: string, payload: unknown): {
  subject: string;
  preview: string;
  fromLabel: string;
  occurredAt: string;
} {
  if (source === "email") {
    const email = payload as EmailPayload;
    return {
      subject: email.subject,
      preview: email.body.slice(0, 220).trim(),
      fromLabel: email.from,
      occurredAt: email.timestamp,
    };
  }
  const event = payload as CalendarPayload;
  return {
    subject: event.title,
    preview: event.description.slice(0, 220).trim(),
    fromLabel: event.organizer,
    occurredAt: event.start,
  };
}

export async function getOpenQuarantineItems(): Promise<QuarantineReport> {
  try {
    const rows = await db
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
      .where(eq(quarantineItems.status, "open"))
      .orderBy(desc(rawEvents.createdAt));

    if (rows.length === 0) return { state: "empty" };

    const items: QuarantineDisplayItem[] = rows.map((r) => {
      const display = displayFromPayload(r.source, r.payload);
      const candidatesRaw = r.candidates as { matches?: { company_id: string; name: string; similarity: number }[] } | null;
      const suggestionRaw = r.suggestedAction as
        | { action: string; company_guess: string | null; confidence: string; rationale: string }
        | null;

      return {
        id: r.id,
        reason: r.reason,
        source: r.source as "email" | "calendar",
        ...display,
        candidates: (candidatesRaw?.matches ?? []).map((m) => ({
          companyId: m.company_id,
          name: m.name,
          similarity: m.similarity,
        })),
        suggestion: suggestionRaw
          ? {
              action: suggestionRaw.action as AiSuggestion["action"],
              companyGuess: suggestionRaw.company_guess,
              confidence: suggestionRaw.confidence as AiSuggestion["confidence"],
              rationale: suggestionRaw.rationale,
            }
          : null,
      };
    });

    return { state: "ok", items };
  } catch (err) {
    console.error("[quarantine] query failed:", err);
    return { state: "error" };
  }
}

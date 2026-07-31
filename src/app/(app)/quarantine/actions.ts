"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { companies, contacts, quarantineItems, rawEvents, users } from "../../../../drizzle/schema";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import { isYunoAddress, type CalendarPayload, type EmailPayload } from "../../../../scripts/classification-rules";
import { nameFromEmailLocal } from "../../../../scripts/resolution-rules";

/** The signed-in user's `users.id` (for quarantine_items.resolved_by) — the
 * Supabase session only carries email, so this looks it up once per action. */
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, user.email));
  return row?.id ?? null;
}

/** The first participant outside yunoai.io — the person this quarantined
 * record is actually about, used as the new/linked contact. */
function primaryExternalParticipant(source: string, payload: unknown): { email: string; name: string } | null {
  const candidates =
    source === "email"
      ? [(payload as EmailPayload).from, ...(payload as EmailPayload).to, ...(payload as EmailPayload).cc]
      : (payload as CalendarPayload).attendees;
  const email = candidates.find((a) => !isYunoAddress(a));
  return email ? { email, name: nameFromEmailLocal(email) } : null;
}

async function loadItemWithEvent(quarantineItemId: string) {
  const [row] = await db
    .select({
      id: quarantineItems.id,
      status: quarantineItems.status,
      rawEventId: quarantineItems.rawEventId,
      source: rawEvents.source,
      payload: rawEvents.payload,
    })
    .from(quarantineItems)
    .innerJoin(rawEvents, eq(rawEvents.id, quarantineItems.rawEventId))
    .where(eq(quarantineItems.id, quarantineItemId));
  return row ?? null;
}

async function resolveQuarantineItem(
  quarantineItemId: string,
  rawEventId: string,
  opts: {
    rawEventStatus: "processed" | "ignored";
    matchedRule: string;
    resolution: string;
    /** The company the human picked, so the resolver uses it instead of
     * inferring one from the sender domain. Null when discarding. */
    resolvedCompanyId?: string | null;
  }
) {
  const resolvedBy = await currentUserId();
  await db.transaction(async (tx) => {
    await tx
      .update(rawEvents)
      .set({ status: opts.rawEventStatus, matchedRule: opts.matchedRule, processedAt: sql`now()` })
      .where(eq(rawEvents.id, rawEventId));
    await tx
      .update(quarantineItems)
      .set({
        status: "resolved",
        resolution: opts.resolution,
        resolvedBy,
        resolvedAt: sql`now()`,
        resolvedCompanyId: opts.resolvedCompanyId ?? null,
      })
      .where(eq(quarantineItems.id, quarantineItemId));
  });
  // Refreshes the quarantine badge count in the sidebar/bottom nav (computed
  // in the (app) layout) on every route under it, not just this page.
  revalidatePath("/", "layout");
}

export async function listCompaniesForLink(): Promise<{ id: string; name: string }[]> {
  return db.select({ id: companies.id, name: companies.name }).from(companies).orderBy(companies.name);
}

export async function createCompanyAndResolve(
  quarantineItemId: string,
  input: { name: string; domain: string | null }
): Promise<ActionResult> {
  const t = await getTranslations("quarantineActions");
  const name = input.name.trim();
  if (!name) return { ok: false, error: t("nameRequired") };

  const item = await loadItemWithEvent(quarantineItemId);
  if (!item || item.status !== "open") return { ok: false, error: t("itemNotOpen") };

  try {
    const [company] = await db
      .insert(companies)
      .values({ name, domain: input.domain?.trim() || null })
      .returning({ id: companies.id });

    const participant = primaryExternalParticipant(item.source, item.payload);
    if (participant) {
      await db
        .insert(contacts)
        .values({ companyId: company.id, email: participant.email, name: participant.name })
        .onConflictDoNothing({ target: contacts.email });
    }

    await resolveQuarantineItem(quarantineItemId, item.rawEventId, {
      rawEventStatus: "processed",
      matchedRule: "quarantine_created_company",
      resolution: `Created new company "${name}"`,
      resolvedCompanyId: company.id,
    });
    return { ok: true };
  } catch (err) {
    console.error("[quarantine] createCompanyAndResolve failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("companies_domain_key")) {
      return { ok: false, error: t("domainConflict") };
    }
    return { ok: false, error: t("createFailed") };
  }
}

export async function linkToExistingAndResolve(quarantineItemId: string, companyId: string): Promise<ActionResult> {
  const t = await getTranslations("quarantineActions");
  const item = await loadItemWithEvent(quarantineItemId);
  if (!item || item.status !== "open") return { ok: false, error: t("itemNotOpen") };

  const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId));
  if (!company) return { ok: false, error: t("companyGone") };

  try {
    const participant = primaryExternalParticipant(item.source, item.payload);
    if (participant) {
      await db
        .insert(contacts)
        .values({ companyId, email: participant.email, name: participant.name })
        .onConflictDoNothing({ target: contacts.email });
    }

    await resolveQuarantineItem(quarantineItemId, item.rawEventId, {
      rawEventStatus: "processed",
      matchedRule: "quarantine_linked_existing",
      resolution: `Linked to "${company.name}"`,
      resolvedCompanyId: companyId,
    });
    return { ok: true };
  } catch (err) {
    console.error("[quarantine] linkToExistingAndResolve failed:", err);
    return { ok: false, error: t("linkFailed") };
  }
}

export async function discardQuarantineItem(quarantineItemId: string): Promise<ActionResult> {
  const t = await getTranslations("quarantineActions");
  const item = await loadItemWithEvent(quarantineItemId);
  if (!item || item.status !== "open") return { ok: false, error: t("itemNotOpen") };

  try {
    await resolveQuarantineItem(quarantineItemId, item.rawEventId, {
      rawEventStatus: "ignored",
      matchedRule: "quarantine_discarded",
      resolution: "Discarded",
    });
    return { ok: true };
  } catch (err) {
    console.error("[quarantine] discardQuarantineItem failed:", err);
    return { ok: false, error: t("discardFailed") };
  }
}

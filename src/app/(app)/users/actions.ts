"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { users } from "../../../../drizzle/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { canManageUsers, decideRoleChange, normalizeInviteEmail, type Role } from "./user-rules";
import { nameFromEmailLocal } from "../../../../scripts/resolution-rules";

type ActionResult = { ok: true } | { ok: false; error: string };

// Same shared demo password every seeded account uses (scripts/seed-users.ts)
// — this is a take-home fixture, not a production credential scheme.
const TEST_PASSWORD = "YunoCRM2026!";

/**
 * These actions are admin-only and the check has to live HERE, not in the
 * page. /users redirects members away, but a server action is a plain POST
 * endpoint any signed-in user can invoke directly — without this, a member
 * could promote themselves. The decision itself is in ./user-rules.ts so it
 * can be tested without a database or a session.
 */
export async function updateUserRole(userId: string, newRole: "admin" | "member"): Promise<ActionResult> {
  const t = await getTranslations("usersActions");
  const caller = await getCurrentAppUser();

  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  const [{ count: adminCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));

  const decision = decideRoleChange({
    callerRole: caller?.role ?? null,
    targetRole: (target?.role as Role | undefined) ?? null,
    newRole,
    adminCount,
  });

  if (decision.kind === "denied") {
    const message =
      decision.reason === "not-allowed"
        ? t("notAllowed")
        : decision.reason === "user-not-found"
          ? t("userNotFound")
          : t("cannotDemoteLastAdmin");
    return { ok: false, error: message };
  }
  if (decision.kind === "noop") return { ok: true };

  await db.update(users).set({ role: newRole }).where(eq(users.id, userId));
  revalidatePath("/users");
  return { ok: true };
}

export async function inviteUser(email: string, role: "admin" | "member"): Promise<ActionResult> {
  const t = await getTranslations("usersActions");
  const caller = await getCurrentAppUser();
  if (!canManageUsers(caller?.role ?? null)) return { ok: false, error: t("notAllowed") };

  const normalized = normalizeInviteEmail(email);
  if (!normalized.ok) return { ok: false, error: t("invalidEmail") };
  const trimmedEmail = normalized.email;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, trimmedEmail));
  if (existing) return { ok: false, error: t("emailTaken") };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { ok: false, error: t("missingAdminCredentials") };

  const admin = createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.createUser({
    email: trimmedEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error && error.code !== "email_exists") {
    return { ok: false, error: error.message };
  }

  await db.insert(users).values({ email: trimmedEmail, name: nameFromEmailLocal(trimmedEmail), role });

  revalidatePath("/users");
  return { ok: true };
}

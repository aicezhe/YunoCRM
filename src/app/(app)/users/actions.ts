"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { users } from "../../../../drizzle/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { nameFromEmailLocal } from "../../../../scripts/resolution-rules";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Both actions below are admin-only, and the check has to live HERE, not in
 * the page. /users redirecting members away protects the screen, but a
 * server action is a plain POST endpoint any signed-in user can invoke
 * directly — without this, a member could promote themselves.
 */
async function callerIsAdmin(): Promise<boolean> {
  const caller = await getCurrentAppUser();
  return caller?.role === "admin";
}

// Same shared demo password every seeded account uses (scripts/seed-users.ts)
// — this is a take-home fixture, not a production credential scheme.
const TEST_PASSWORD = "YunoCRM2026!";

export async function updateUserRole(userId: string, newRole: "admin" | "member"): Promise<ActionResult> {
  const t = await getTranslations("usersActions");
  if (!(await callerIsAdmin())) return { ok: false, error: t("notAllowed") };

  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (!target) return { ok: false, error: t("userNotFound") };
  if (target.role === newRole) return { ok: true };

  if (target.role === "admin" && newRole === "member") {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin"));
    if (count <= 1) {
      return { ok: false, error: t("cannotDemoteLastAdmin") };
    }
  }

  await db.update(users).set({ role: newRole }).where(eq(users.id, userId));
  revalidatePath("/users");
  return { ok: true };
}

export async function inviteUser(email: string, role: "admin" | "member"): Promise<ActionResult> {
  const t = await getTranslations("usersActions");
  if (!(await callerIsAdmin())) return { ok: false, error: t("notAllowed") };

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes("@")) return { ok: false, error: t("invalidEmail") };

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

import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "../../../drizzle/schema";
import { createClient } from "@/lib/supabase/server";

export type CurrentAppUser = {
  email: string;
  name: string;
  role: "admin" | "member";
} | null;

/**
 * The signed-in user's app-level identity (name + role), wrapped in React's
 * `cache()` so it runs at most once per request no matter how many Server
 * Components call it.
 *
 * Before this, every protected page paid for supabase.auth.getUser() (a
 * network round-trip to Supabase Auth) AND a `users` table lookup twice
 * over — once in the (app) layout, once again in the page itself
 * (dashboard/page.tsx, users/page.tsx each re-did both). proxy.ts's own
 * getUser() call is unavoidable — it runs in middleware, a separate request
 * phase cache() can't reach — but the two calls inside the Server Component
 * render tree now collapse into one.
 */
export const getCurrentAppUser = cache(async (): Promise<CurrentAppUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  // This is called from the (app) layout, so an uncaught throw here used to
  // take down every authenticated page at once — including ones whose own
  // data queries handle a database outage gracefully. A lookup failure
  // (unreachable database, not just a missing row) degrades to the same
  // email-derived fallback as a genuinely missing profile row, rather than
  // crashing the shell around it. Defaulting to "member" here is also the
  // safe direction to fail in: admin-only server actions re-check the
  // caller's role themselves, so this can under-grant but never over-grant.
  try {
    const [row] = await db.select({ name: users.name, role: users.role }).from(users).where(eq(users.email, user.email));
    if (!row) return { email: user.email, name: user.email.split("@")[0], role: "member" };
    return { email: user.email, name: row.name, role: row.role as "admin" | "member" };
  } catch (err) {
    console.error("[auth] profile lookup failed:", err);
    return { email: user.email, name: user.email.split("@")[0], role: "member" };
  }
});

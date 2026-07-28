import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, quarantineItems } from "../../../drizzle/schema";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { BottomNav } from "@/components/bottom-nav";
import { Sidebar } from "@/components/sidebar";

/** Shared shell for every protected route: a mobile top bar + BottomNav
 * below md, a desktop Sidebar at md and up — see NAV_ITEMS for the single
 * source of truth both read from. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let name = user?.email?.split("@")[0] ?? "there";
  if (user?.email) {
    try {
      const [row] = await db
        .select({ name: users.name, role: users.role })
        .from(users)
        .where(eq(users.email, user.email));
      isAdmin = row?.role === "admin";
      if (row?.name) name = row.name;
    } catch (err) {
      console.error("[app-layout] user lookup failed:", err);
    }
  }

  let quarantineOpenCount = 0;
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quarantineItems)
      .where(eq(quarantineItems.status, "open"));
    quarantineOpenCount = row?.count ?? 0;
  } catch (err) {
    console.error("[app-layout] quarantine count failed:", err);
  }

  return (
    <div className="min-h-dvh bg-[#FCFBFF] font-sans">
      {/* Mobile-only top bar — desktop shows the same logo/user/sign-out
          inside Sidebar instead. */}
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5 sm:px-6 sm:py-6 md:hidden">
        <span className="text-lg font-semibold tracking-tight text-[#5B4FE9] sm:text-xl">
          Yuno<span className="text-gray-900">CRM</span>
        </span>
        <div className="flex items-center gap-4">
          {/* The email is the first thing to go when width is scarce. */}
          <span className="hidden truncate text-sm text-gray-500 sm:inline">{user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <Sidebar isAdmin={isAdmin} quarantineOpenCount={quarantineOpenCount} name={name} email={user?.email} />

      {/* pb clears the fixed mobile BottomNav; md:ml clears the fixed
          desktop Sidebar instead, and md:pb-0 since there's no bottom nav
          to clear there. */}
      <div className="pb-28 md:ml-60 md:pb-0">{children}</div>

      <BottomNav isAdmin={isAdmin} quarantineOpenCount={quarantineOpenCount} />
    </div>
  );
}

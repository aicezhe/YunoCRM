import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, quarantineItems } from "../../../drizzle/schema";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { BottomNav } from "@/components/bottom-nav";

/** Shared shell for every protected route: header + bottom nav. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user?.email) {
    try {
      const [row] = await db.select({ role: users.role }).from(users).where(eq(users.email, user.email));
      isAdmin = row?.role === "admin";
    } catch (err) {
      console.error("[app-layout] role lookup failed:", err);
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
    <div className="min-h-dvh bg-gradient-to-br from-[#EEEBFF] via-[#F7F5FF] to-white font-sans">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5 sm:px-6 sm:py-6">
        <span className="text-lg font-semibold tracking-tight text-[#5B4FE9] sm:text-xl">
          Yuno<span className="text-gray-900">CRM</span>
        </span>
        <div className="flex items-center gap-4">
          {/* The email is the first thing to go when width is scarce. */}
          <span className="hidden truncate text-sm text-gray-500 sm:inline">{user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      {/* pb clears the fixed BottomNav so content never sits behind it. */}
      <div className="pb-28">{children}</div>

      <BottomNav isAdmin={isAdmin} quarantineOpenCount={quarantineOpenCount} />
    </div>
  );
}

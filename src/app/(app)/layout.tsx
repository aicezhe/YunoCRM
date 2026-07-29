import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { quarantineItems } from "../../../drizzle/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { SignOutButton } from "@/components/sign-out-button";
import { BottomNav } from "@/components/bottom-nav";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Sidebar } from "@/components/sidebar";

async function getQuarantineOpenCount(): Promise<number> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quarantineItems)
      .where(eq(quarantineItems.status, "open"));
    return row?.count ?? 0;
  } catch (err) {
    console.error("[app-layout] quarantine count failed:", err);
    return 0;
  }
}

/** Shared shell for every protected route: a mobile top bar + BottomNav
 * below md, a desktop Sidebar at md and up — see NAV_ITEMS for the single
 * source of truth both read from. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // getCurrentAppUser() is React-cache()'d, so this doesn't cost a second
  // auth round-trip when the page below also calls it (dashboard/page.tsx,
  // users/page.tsx) — both hit the same memoized call within this request.
  // Runs alongside the quarantine count instead of after it: two unrelated
  // queries no longer wait on each other in sequence.
  const [appUser, quarantineOpenCount] = await Promise.all([getCurrentAppUser(), getQuarantineOpenCount()]);

  const isAdmin = appUser?.role === "admin";
  const name = appUser?.name ?? "there";
  const email = appUser?.email;

  return (
    <div className="min-h-dvh bg-[#FCFBFF] font-sans">
      {/* Mobile-only top bar — desktop shows the same logo/user/sign-out
          inside Sidebar instead. */}
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5 sm:px-6 sm:py-6 md:hidden">
        <span className="text-lg font-semibold tracking-tight text-[#5B4FE9] sm:text-xl">
          Yuno<span className="text-gray-900">CRM</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* The email is the first thing to go when width is scarce. */}
          <span className="hidden truncate text-sm text-gray-500 sm:inline">{email}</span>
          <LocaleSwitcher open="down" />
          <SignOutButton />
        </div>
      </header>

      <Sidebar isAdmin={isAdmin} quarantineOpenCount={quarantineOpenCount} name={name} email={email} />

      {/* pb clears the fixed mobile BottomNav; md:ml clears the fixed
          desktop Sidebar instead, and md:pb-0 since there's no bottom nav
          to clear there. */}
      <div className="pb-28 md:ml-60 md:pb-0">{children}</div>

      <BottomNav isAdmin={isAdmin} quarantineOpenCount={quarantineOpenCount} />
    </div>
  );
}

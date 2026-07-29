"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { NAV_ITEMS } from "./nav-items";
import { SignOutButton } from "./sign-out-button";

const SIDEBAR_WIDTH = "w-60";

/**
 * Fixed left sidebar for desktop (>= md). Hidden below md, where BottomNav
 * takes over instead. Always visible — no collapse/hamburger, matching the
 * standing B2B-tool pattern (Linear/Notion/Supabase) rather than a mobile
 * drawer, since desktop has the width to spare. Reads the same NAV_ITEMS
 * list BottomNav does.
 */
export function Sidebar({
  isAdmin,
  quarantineOpenCount,
  name,
  email,
}: {
  isAdmin: boolean;
  quarantineOpenCount: number;
  name: string;
  email: string | undefined;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden ${SIDEBAR_WIDTH} flex-col border-r border-[#E4DFFC] bg-gradient-to-b from-[#EEEBFF] to-[#E9E4FC] backdrop-blur-md md:flex`}
    >
      <div className="px-6 py-6">
        <span className="text-lg font-semibold tracking-tight text-[#5B4FE9]">
          Yuno<span className="text-gray-900">CRM</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          const badge = item.href === "/quarantine" ? quarantineOpenCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors " +
                (active
                  ? "bg-white font-semibold text-[#5B4FE9] shadow-sm"
                  : "font-medium text-gray-500 hover:bg-white/50 hover:text-gray-900")
              }
            >
              <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#5B4FE9] px-1.5 text-[11px] font-semibold text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#DDD6FA] px-4 py-4">
        <p className="truncate px-2 text-sm font-medium text-gray-900">{name}</p>
        {email && <p className="truncate px-2 text-xs text-gray-400">{email}</p>}
        <div className="mt-3 flex items-center gap-2 px-2">
          <SignOutButton />
          <LocaleSwitcher />
        </div>
      </div>
    </aside>
  );
}

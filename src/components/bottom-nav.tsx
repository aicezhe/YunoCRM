"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

/**
 * Fixed bottom navigation for mobile (< md). Hidden at md+, where Sidebar
 * takes over instead — see src/app/(app)/layout.tsx. Reads the same
 * NAV_ITEMS list Sidebar does, so the admin-only Users rule lives in one
 * place, not duplicated per nav variant.
 */
export function BottomNav({
  isAdmin,
  quarantineOpenCount,
}: {
  isAdmin: boolean;
  quarantineOpenCount: number;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-[#E4DFFC] bg-gradient-to-t from-[#EEEBFF] to-[#F3F0FD]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex w-full max-w-5xl items-stretch justify-around px-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          const badge = item.href === "/quarantine" ? quarantineOpenCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-gray-400 transition-colors"
            >
              <span className="relative">
                <Icon
                  className={active ? "h-5 w-5 text-[#5B4FE9]" : "h-5 w-5"}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#5B4FE9] px-1 text-[10px] font-semibold leading-none text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span className={active ? "text-[11px] font-medium text-[#5B4FE9]" : "text-[11px] font-medium"}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

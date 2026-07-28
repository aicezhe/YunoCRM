"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Search, ShieldAlert, Users, type LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

/**
 * Fixed bottom navigation shown on every protected route (a deliberate
 * mobile/PWA-style pattern rather than a top nav, per the brief). Rendered
 * from the (app) layout, so it persists across dashboard/search/quarantine/
 * users without remounting.
 */
export function BottomNav({
  isAdmin,
  quarantineOpenCount,
}: {
  isAdmin: boolean;
  quarantineOpenCount: number;
}) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    { href: "/search", label: "Search", icon: Search },
    { href: "/quarantine", label: "Quarantine", icon: ShieldAlert, badge: quarantineOpenCount },
    ...(isAdmin ? [{ href: "/users", label: "Users", icon: Users }] : []),
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-5xl items-stretch justify-around px-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
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
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#5B4FE9] px-1 text-[10px] font-semibold leading-none text-white">
                    {item.badge > 9 ? "9+" : item.badge}
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

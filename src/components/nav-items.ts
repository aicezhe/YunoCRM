import { LayoutGrid, Search, ShieldAlert, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  /** Key under the "nav" namespace — resolved by each nav component, since
   * this module is imported by Server and Client Components alike and must
   * stay free of hooks. */
  labelKey: "dashboard" | "search" | "quarantine" | "users";
  icon: LucideIcon;
  /** Only rendered (BottomNav and Sidebar alike) when the viewer is an admin. */
  adminOnly?: boolean;
};

/** The four sections shared by both the mobile BottomNav and the desktop
 * Sidebar — one list so the admin-only Users rule lives in exactly one
 * place instead of being duplicated per nav variant. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutGrid },
  { href: "/search", labelKey: "search", icon: Search },
  { href: "/quarantine", labelKey: "quarantine", icon: ShieldAlert },
  { href: "/users", labelKey: "users", icon: Users, adminOnly: true },
];

import { LayoutGrid, Search, ShieldAlert, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only rendered (BottomNav and Sidebar alike) when the viewer is an admin. */
  adminOnly?: boolean;
};

/** The four sections shared by both the mobile BottomNav and the desktop
 * Sidebar — one list so the admin-only Users rule lives in exactly one
 * place instead of being duplicated per nav variant. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/search", label: "Search", icon: Search },
  { href: "/quarantine", label: "Quarantine", icon: ShieldAlert },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
];

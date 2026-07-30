"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

/**
 * Shift+1..4 jumps to the nav sections, in the order they appear in the
 * sidebar. Numbers are derived from NAV_ITEMS rather than hardcoded, so the
 * shortcut and the visible order cannot drift apart.
 */
export function NavShortcuts({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

    function onKeyDown(e: KeyboardEvent) {
      // Shift alone. Cmd/Ctrl+1..9 is the browser's tab switcher and Alt is
      // used by screen readers, so those combinations are left alone.
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;

      // Shift+1 types "!". Without this, typing punctuation into the search
      // box would navigate away mid-query.
      const target = e.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      // `code`, not `key`: on a Russian or Italian layout Shift+1 still
      // reports Digit1, while `key` would be "!" only on some layouts.
      const match = /^Digit([1-9])$/.exec(e.code);
      if (!match) return;

      const item = items[Number(match[1]) - 1];
      if (!item) return; // a member pressing Shift+4 — no Users section for them

      e.preventDefault();
      router.push(item.href);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAdmin, router]);

  return null;
}

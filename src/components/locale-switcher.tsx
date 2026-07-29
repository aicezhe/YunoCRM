"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { Check, Globe } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type Locale } from "@/i18n/locales";

/**
 * Compact language picker. Writing the cookie server-side and revalidating
 * the layout is what swaps the language — no router.push, so the user stays
 * exactly where they were and no route path changes.
 */
export function LocaleSwitcher({
  className = "",
  /** Which way the list opens. "up" suits the sidebar footer; "down" the
   * login page and the mobile header, where opening up would run off-screen. */
  open: openDirection = "up",
}: {
  className?: string;
  open?: "up" | "down";
}) {
  const current = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(locale: Locale) {
    setOpen(false);
    if (locale === current) return;
    startTransition(() => {
      setLocale(locale);
    });
  }

  return (
    <div ref={rootRef} className={"relative " + className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#5B4FE9]/20 bg-white/70 px-2.5 text-xs font-semibold text-[#5B4FE9] transition hover:bg-white disabled:opacity-60"
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={2} />
        {LOCALE_SHORT[current]}
      </button>

      {open && (
        <ul
          role="listbox"
          className={
            "absolute right-0 z-50 min-w-[9rem] overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg " +
            (openDirection === "up" ? "bottom-full mb-1" : "top-full mt-1")
          }
        >
          {LOCALES.map((locale) => (
            <li key={locale}>
              <button
                type="button"
                role="option"
                aria-selected={locale === current}
                onClick={() => choose(locale)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-[#5B4FE9]/5"
              >
                {LOCALE_LABELS[locale]}
                {locale === current && <Check className="h-3.5 w-3.5 text-[#5B4FE9]" strokeWidth={2.5} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

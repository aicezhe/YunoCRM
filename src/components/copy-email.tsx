"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Mail } from "lucide-react";
import { useTranslations } from "next-intl";

type State = "idle" | "copied" | "failed";

const FEEDBACK_MS = 1600;

/**
 * An email with a one-click copy affordance. The address stays selectable
 * text so it can still be highlighted by hand — the button is an addition,
 * not a replacement.
 */
export function CopyEmail({ email, className = "" }: { email: string; className?: string }) {
  const t = useTranslations("common");
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Without this, unmounting mid-feedback (closing the overlay right after
  // copying) leaves a timer pointing at a dead component.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      // Only available in a secure context; a plain-http origin throws here
      // rather than silently doing nothing, so the failed state is real.
      await navigator.clipboard.writeText(email);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), FEEDBACK_MS);
  }

  return (
    <span className={"group/copy inline-flex min-w-0 items-center gap-1.5 " + className}>
      <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={2} />
      <span className="truncate">{email}</span>

      <button
        type="button"
        onClick={copy}
        aria-label={t("copyEmail", { email })}
        className="relative -my-1 shrink-0 rounded-md p-1 text-gray-400 opacity-60 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:opacity-100 group-hover/copy:opacity-100"
      >
        <AnimatePresence mode="wait" initial={false}>
          {state === "copied" ? (
            <motion.span
              key="done"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="block text-green-600"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="block"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={2} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Screen readers get the outcome announced; sighted users get the tick.
          Kept out of the layout so a long "copied" string can't reflow the row. */}
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? t("copied") : state === "failed" ? t("copyFailed") : ""}
      </span>

      <AnimatePresence>
        {state === "failed" && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="shrink-0 text-xs text-red-600"
          >
            {t("copyFailed")}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

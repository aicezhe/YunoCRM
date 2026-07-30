"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search as SearchIcon, Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { runSearch } from "./actions";
import { CompanyOverlay } from "./company-overlay";
import { channelLabel } from "@/i18n/channel-labels";
import { displayedText, initialTypewriterState, nextTypewriterState, tickDelayMs } from "./typewriter-core";
import type { SearchReport, SearchResult } from "./queries";

const STAGE_COLORS: Record<string, string> = {
  Won: "bg-green-100 text-green-700",
  Lost: "bg-gray-200 text-gray-600",
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
};

// The whole grid should finish revealing within this budget. A fixed
// per-card delay does not survive a long list: at 0.07s each, "Show full
// list" (76 companies) took 5.3s to finish appearing even though the data
// had arrived in under half a second, which reads as the app being slow.
const REVEAL_BUDGET_S = 0.5;
const MAX_STAGGER_S = 0.07;

const gridVariants = {
  hidden: {},
  visible: (count: number) => ({
    transition: { staggerChildren: Math.min(MAX_STAGGER_S, REVEAL_BUDGET_S / Math.max(count, 1)) },
  }),
};

function ResultCard({ result, onOpen }: { result: SearchResult; onOpen: (e: React.MouseEvent) => void }) {
  const t = useTranslations("search");
  const tStage = useTranslations("stages");
  const tChannel = useTranslations("channels");
  return (
    <motion.a
      href={`/companies/${result.id}`}
      onClick={onOpen}
      layoutId={`company-card-${result.id}`}
      variants={cardVariants}
      className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-gray-900">
          <Building2 className="h-4 w-4 shrink-0 text-[#5B4FE9]" strokeWidth={1.75} />
          {result.name}
        </span>
        {result.similarity !== undefined && (
          <span className="shrink-0 rounded-full bg-[#5B4FE9]/10 px-2 py-0.5 text-xs font-medium text-[#5B4FE9]">
            {t("matchPct", { pct: Math.round(result.similarity * 100) })}
          </span>
        )}
      </div>
      {result.domain && <p className="text-xs text-gray-400">{result.domain}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {result.stage && (
          <span
            className={"rounded-full px-2 py-0.5 text-xs font-medium " + (STAGE_COLORS[result.stage] ?? "bg-[#5B4FE9]/10 text-[#5B4FE9]")}
          >
            {tStage(result.stage)}
          </span>
        )}
        {result.channel && (
          <span className="text-xs text-gray-400">{channelLabel(tChannel, result.channel)}</span>
        )}
      </div>
      {result.matchedContact && (
        <p className="text-xs text-[#5B4FE9]">
          {t("matchedVia", { name: result.matchedContact.name ?? result.matchedContact.email })}
        </p>
      )}
    </motion.a>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-white shadow-sm" />
      ))}
    </div>
  );
}

export function SearchClient() {
  const t = useTranslations("search");
  const [query, setQuery] = useState("");
  const [smart, setSmart] = useState(false);
  // The report is kept together with the mode that produced it, as one atom.
  // The empty state's wording differs for smart vs normal, and reading that
  // off the live `smart` toggle meant flipping the switch after a search
  // silently rewrote the explanation for a result it never re-ran.
  const [result, setResult] = useState<{ report: SearchReport; smart: boolean } | null>(null);
  const report = result?.report ?? null;
  const reportSmart = result?.smart ?? false;
  const [isPending, startTransition] = useTransition();
  const [focused, setFocused] = useState(false);
  const [placeholderText, setPlaceholderText] = useState("");
  const [expanded, setExpanded] = useState<SearchResult | null>(null);
  const hasSearched = report !== null || isPending;

  const placeholderPhrases = [t("placeholderPhrase1"), t("placeholderPhrase2"), t("placeholderPhrase3")];

  // Animated placeholder — stops as soon as the user has typed anything.
  useEffect(() => {
    if (query.length > 0) return;
    let state = initialTypewriterState();
    let timeoutId: ReturnType<typeof setTimeout>;
    function tick() {
      state = nextTypewriterState(state, placeholderPhrases);
      setPlaceholderText(displayedText(state, placeholderPhrases));
      timeoutId = setTimeout(tick, tickDelayMs(state));
    }
    timeoutId = setTimeout(tick, 70);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.length === 0]);

  function runQuery(q: string, smartMode: boolean) {
    startTransition(async () => {
      const found = await runSearch(q, smartMode);
      setResult({ report: found, smart: smartMode });
    });
  }

  function submit() {
    runQuery(query, smart);
  }

  function showFullList() {
    setQuery("");
    setSmart(false);
    runQuery("", false);
  }

  // Desktop equivalent of the mobile-only "Show full list" button — the
  // button takes real space next to Search/Smart search on a wide screen
  // where a shortcut is more natural, so it's hidden there (md:hidden) in
  // favor of ⌘⇧F.
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        showFullList();
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The results stay mounted behind the overlay, so without this the page
  // scrolls under it — and scrolling a layout-projected element mid-morph
  // makes it chase the moving target.
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  function openResult(e: React.MouseEvent, result: SearchResult) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let the browser open a new tab
    e.preventDefault();
    setExpanded(result);
  }

  return (
    <div className={hasSearched ? "" : "flex min-h-[60vh] flex-col justify-center"}>
      <div className={hasSearched ? "" : "mx-auto w-full max-w-2xl"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <div
              aria-hidden
              className={
                "pointer-events-none absolute -inset-1 rounded-3xl bg-[#5B4FE9] blur-2xl transition-opacity duration-300 " +
                (focused ? "opacity-15" : "opacity-[0.05]")
              }
            />
            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-gray-400"
                strokeWidth={2}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={placeholderText || t("placeholder")}
                className="min-h-12 w-full rounded-2xl border border-white/70 bg-white/60 pr-4 pl-11 text-[16px] text-gray-900 shadow-sm outline-none backdrop-blur-md placeholder:text-gray-400 focus:border-[#5B4FE9]/40 focus:bg-white/80 focus:ring-4 focus:ring-[#5B4FE9]/10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="min-h-12 shrink-0 rounded-2xl bg-[#5B4FE9] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4B3FE0] disabled:opacity-60"
            >
              {t("searchButton")}
            </button>
            <button
              type="button"
              onClick={showFullList}
              disabled={isPending}
              className="min-h-12 shrink-0 rounded-2xl border border-[#5B4FE9]/25 bg-white/50 px-4 text-sm font-semibold text-[#5B4FE9] shadow-sm backdrop-blur-sm transition hover:bg-[#5B4FE9]/5 disabled:opacity-60 md:hidden"
            >
              {t("showFullList")}
            </button>
          </div>
        </form>

        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-sm text-gray-500">
          <span
            role="switch"
            aria-checked={smart}
            onClick={() => setSmart((s) => !s)}
            className={
              "relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border transition-colors " +
              (smart ? "border-[#4B3FE0] bg-[#5B4FE9]" : "border-gray-200 bg-white")
            }
          >
            <span
              className={
                "inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform " +
                (smart ? "translate-x-9" : "translate-x-1")
              }
            />
          </span>
          {t("smartSearch")}
          <span className="text-xs text-gray-400">{t("smartSearchHint")}</span>
        </label>

        <p className="mt-2 hidden text-center text-xs text-gray-400 md:block">
          {t("press")} <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-gray-600 shadow-sm">⌘</kbd>
          {" "}
          <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-gray-600 shadow-sm">⇧</kbd>
          {" "}
          <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-gray-600 shadow-sm">F</kbd>
          {" "}{t("kbdHint")}
        </p>
      </div>

      {/* Deliberately NOT gated on `!expanded`. Unmounting the results while
          the overlay is open meant the whole grid was rebuilt on close and
          replayed its staggered reveal — 76 cards fading back in, which reads
          as the page reloading. It also defeats the shared-element
          transition: the card the panel morphs back into has to still exist.
          The overlay covers the grid anyway (fixed, z-50, over a backdrop). */}
      {hasSearched && (
        <div className="mt-8">
          {isPending && <ResultsSkeleton />}

          {!isPending && report?.state === "error" && (
            <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{t("error")}</p>
          )}

          {!isPending && report?.state === "unconfigured" && (
            <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <p className="font-medium">{t("unconfiguredTitle")}</p>
              <p className="mt-1 text-amber-800">
                {report.reason === "no_api_key" ? t("unconfiguredNoKey") : t("unconfiguredNoEmbeddings")}{" "}
                {t("unconfiguredFooter")}
              </p>
            </div>
          )}

          {!isPending && report?.state === "empty" && (
            <p className="rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
              {report.query
                ? reportSmart
                  ? t("emptySmart", { query: report.query })
                  : t("emptyNormal", { query: report.query })
                : t("emptyNoQuery")}
            </p>
          )}

          {!isPending && report?.state === "ok" && (
            <>
              <p className="mb-3 text-xs text-gray-400">{t("resultCount", { count: report.results.length })}</p>
              <motion.div
                initial="hidden"
                animate="visible"
                custom={report.results.length}
                variants={gridVariants}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {report.results.map((r) => (
                  <ResultCard key={r.id} result={r} onOpen={(e) => openResult(e, r)} />
                ))}
              </motion.div>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="overlay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-sm"
            onClick={() => setExpanded(null)}
          />
        )}
        {expanded && (
          <motion.div
            key={`overlay-panel-${expanded.id}`}
            layoutId={`company-card-${expanded.id}`}
            // Without an exit of its own, AnimatePresence has nothing to wait
            // for and tears the panel out while the backdrop is still fading.
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed inset-4 z-50 sm:inset-8"
          >
            <CompanyOverlay
              companyId={expanded.id}
              matchedContact={expanded.matchedContact}
              onClose={() => setExpanded(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search as SearchIcon, Building2 } from "lucide-react";
import { runSearch } from "./actions";
import { CompanyOverlay } from "./company-overlay";
import { displayedText, initialTypewriterState, nextTypewriterState, tickDelayMs } from "./typewriter-core";
import type { SearchReport, SearchResult } from "./queries";

const CHANNEL_LABELS: Record<string, string> = {
  website: "Website",
  linkedin_outbound: "LinkedIn outbound",
  referral: "Referral",
  event: "Events / trade fairs",
  content_inbound: "Content inbound",
  manual: "Manual",
};

const STAGE_COLORS: Record<string, string> = {
  Won: "bg-green-100 text-green-700",
  Lost: "bg-gray-200 text-gray-600",
};

const PLACEHOLDER_PHRASES = [
  "Search companies by name...",
  "Try: automotive supplier in Lombardy",
  "Try: family-owned logistics company",
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
};

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

function ResultCard({ result, onOpen }: { result: SearchResult; onOpen: (e: React.MouseEvent) => void }) {
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
            {Math.round(result.similarity * 100)}% match
          </span>
        )}
      </div>
      {result.domain && <p className="text-xs text-gray-400">{result.domain}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {result.stage && (
          <span
            className={"rounded-full px-2 py-0.5 text-xs font-medium " + (STAGE_COLORS[result.stage] ?? "bg-[#5B4FE9]/10 text-[#5B4FE9]")}
          >
            {result.stage}
          </span>
        )}
        {result.channel && (
          <span className="text-xs text-gray-400">{CHANNEL_LABELS[result.channel] ?? result.channel}</span>
        )}
      </div>
      {result.matchedContact && (
        <p className="text-xs text-[#5B4FE9]">
          Matched via: {result.matchedContact.name ?? result.matchedContact.email}
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
  const [query, setQuery] = useState("");
  const [smart, setSmart] = useState(false);
  const [report, setReport] = useState<SearchReport | null>(null);
  const [isPending, startTransition] = useTransition();
  const [focused, setFocused] = useState(false);
  const [placeholderText, setPlaceholderText] = useState("");
  const [expanded, setExpanded] = useState<SearchResult | null>(null);
  const hasSearched = report !== null || isPending;

  // Animated placeholder — stops as soon as the user has typed anything.
  useEffect(() => {
    if (query.length > 0) return;
    let state = initialTypewriterState();
    let timeoutId: ReturnType<typeof setTimeout>;
    function tick() {
      state = nextTypewriterState(state, PLACEHOLDER_PHRASES);
      setPlaceholderText(displayedText(state, PLACEHOLDER_PHRASES));
      timeoutId = setTimeout(tick, tickDelayMs(state));
    }
    timeoutId = setTimeout(tick, 70);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.length === 0]);

  function runQuery(q: string, smartMode: boolean) {
    startTransition(async () => {
      const result = await runSearch(q, smartMode);
      setReport(result);
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
                "pointer-events-none absolute -inset-1 rounded-3xl bg-[#5B4FE9] blur-xl transition-opacity duration-300 " +
                (focused ? "opacity-25" : "opacity-[0.08]")
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
                placeholder={placeholderText || "Search companies by name, industry, or description..."}
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
              Search
            </button>
            <button
              type="button"
              onClick={showFullList}
              disabled={isPending}
              className="min-h-12 shrink-0 rounded-2xl border border-[#5B4FE9]/25 bg-white/50 px-4 text-sm font-semibold text-[#5B4FE9] shadow-sm backdrop-blur-sm transition hover:bg-[#5B4FE9]/5 disabled:opacity-60"
            >
              Show full list
            </button>
          </div>
        </form>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-500">
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
          Smart search
          <span className="text-xs text-gray-400">— understands meaning, not just exact words</span>
        </label>
      </div>

      {hasSearched && !expanded && (
        <div className="mt-8">
          {isPending && <ResultsSkeleton />}

          {!isPending && report?.state === "error" && (
            <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
              Something went wrong running that search. Try again.
            </p>
          )}

          {!isPending && report?.state === "empty" && (
            <p className="rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
              {report.query
                ? smart
                  ? `No companies found for "${report.query}" — try turning off Smart search for an exact match.`
                  : `No results for "${report.query}".`
                : "No companies yet."}
            </p>
          )}

          {!isPending && report?.state === "ok" && (
            <>
              <p className="mb-3 text-xs text-gray-400">
                {report.results.length} result{report.results.length === 1 ? "" : "s"}
              </p>
              <motion.div
                initial="hidden"
                animate="visible"
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
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed inset-4 z-50 sm:inset-8"
            style={{ transformStyle: "preserve-3d" }}
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

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Search as SearchIcon, Building2, User } from "lucide-react";
import { runSearch } from "./actions";
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

function ResultCard({ result }: { result: SearchResult }) {
  if (result.kind === "company") {
    return (
      <Link
        href={`/companies/${result.id}`}
        className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
            <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (STAGE_COLORS[result.stage] ?? "bg-[#5B4FE9]/10 text-[#5B4FE9]")}>
              {result.stage}
            </span>
          )}
          {result.channel && (
            <span className="text-xs text-gray-400">{CHANNEL_LABELS[result.channel] ?? result.channel}</span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/companies/${result.companyId}`}
      className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex items-center gap-2 font-medium text-gray-900">
        <User className="h-4 w-4 shrink-0 text-[#5B4FE9]" strokeWidth={1.75} />
        {result.name ?? result.email}
      </span>
      <p className="text-xs text-gray-400">{result.email}</p>
      <p className="text-xs font-medium text-[#5B4FE9]">Contact at {result.companyName}</p>
    </Link>
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
  const hasSearched = report !== null || isPending;

  function submit() {
    startTransition(async () => {
      const result = await runSearch(query, smart);
      setReport(result);
    });
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
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-gray-400"
              strokeWidth={2}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies by name, industry, or description..."
              className="min-h-12 w-full rounded-2xl border border-gray-200 bg-white pr-4 pl-11 text-[16px] text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-[#5B4FE9]/50 focus:ring-4 focus:ring-[#5B4FE9]/10"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-12 shrink-0 rounded-2xl bg-[#5B4FE9] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4B3FE0] disabled:opacity-60"
          >
            Search
          </button>
        </form>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-500">
          <span
            role="switch"
            aria-checked={smart}
            onClick={() => setSmart((s) => !s)}
            className={
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
              (smart ? "bg-[#5B4FE9]" : "bg-gray-200")
            }
          >
            <span
              className={
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform " +
                (smart ? "translate-x-6" : "translate-x-1")
              }
            />
          </span>
          Smart search
          <span className="text-xs text-gray-400">— understands meaning, not just exact words</span>
        </label>
      </div>

      {hasSearched && (
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {report.results.map((r) => (
                  <ResultCard key={`${r.kind}-${r.id}`} result={r} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

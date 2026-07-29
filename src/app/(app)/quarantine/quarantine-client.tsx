"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, CheckCircle2, Mail, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createCompanyAndResolve, discardQuarantineItem, linkToExistingAndResolve, listCompaniesForLink } from "./actions";
import type { QuarantineDisplayItem } from "./queries";

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-200 text-gray-600",
};

function fmtDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function EmptyState() {
  const t = useTranslations("quarantine");
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-600">
        <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
      </span>
      <h2 className="text-lg font-semibold text-gray-900">{t("allClear")}</h2>
      <p className="max-w-sm text-sm text-gray-500">{t("allClearSubtitle")}</p>
    </div>
  );
}

function QuarantineCard({ item, onResolved }: { item: QuarantineDisplayItem; onResolved: () => void }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("quarantine");
  const tReason = useTranslations("quarantineReasons");
  const tConfidence = useTranslations("confidence");
  const [mode, setMode] = useState<"idle" | "create" | "link">("idle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(item.suggestion?.companyGuess ?? "");
  const [domain, setDomain] = useState("");
  const [companyList, setCompanyList] = useState<{ id: string; name: string }[] | null>(null);
  const [linkQuery, setLinkQuery] = useState("");

  function afterSuccess() {
    onResolved();
    router.refresh(); // picks up the fresh quarantine badge count in the nav
  }

  function handleLink(companyId: string) {
    setError(null);
    startTransition(async () => {
      const res = await linkToExistingAndResolve(item.id, companyId);
      if (!res.ok) return setError(res.error);
      afterSuccess();
    });
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createCompanyAndResolve(item.id, { name, domain: domain.trim() || null });
      if (!res.ok) return setError(res.error);
      afterSuccess();
    });
  }

  function handleDiscard() {
    setError(null);
    startTransition(async () => {
      const res = await discardQuarantineItem(item.id);
      if (!res.ok) return setError(res.error);
      afterSuccess();
    });
  }

  async function openLinkMode() {
    setMode("link");
    setError(null);
    if (!companyList) setCompanyList(await listCompaniesForLink());
  }

  const Icon = item.source === "email" ? Mail : Calendar;
  const filteredCompanies = (companyList ?? []).filter((c) => c.name.toLowerCase().includes(linkQuery.toLowerCase())).slice(0, 8);

  let reasonLabel: string;
  try {
    reasonLabel = tReason(item.reason);
  } catch {
    reasonLabel = item.reason;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{item.subject}</p>
          <p className="text-xs text-gray-400">
            {item.fromLabel} · {fmtDateTime(item.occurredAt, locale)}
          </p>
        </div>
      </div>

      <p className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">{item.preview}…</p>

      <p className="mt-3 text-xs font-medium text-gray-500">{reasonLabel}</p>

      {item.suggestion && (
        <div className="mt-3 rounded-2xl border border-[#5B4FE9]/15 bg-[#5B4FE9]/5 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#5B4FE9]" strokeWidth={1.75} />
            <span className="text-sm font-semibold text-gray-900">{t("aiSuggestion")}</span>
            <span className={"ml-auto rounded-full px-2 py-0.5 text-xs font-medium " + CONFIDENCE_STYLES[item.suggestion.confidence]}>
              {tConfidence(item.suggestion.confidence)}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">{item.suggestion.rationale}</p>
          {item.suggestion.companyGuess && (
            <p className="mt-1 text-xs text-gray-500">
              {t("guess")} <span className="font-medium text-gray-700">{item.suggestion.companyGuess}</span>
            </p>
          )}
        </div>
      )}

      {item.candidates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.candidates.map((c) => (
            <button
              key={c.companyId}
              disabled={isPending}
              onClick={() => handleLink(c.companyId)}
              className="rounded-full border border-[#5B4FE9]/25 bg-white px-3 py-1.5 text-xs font-medium text-[#5B4FE9] transition hover:bg-[#5B4FE9]/5 disabled:opacity-50"
            >
              {t("didYouMean", { name: c.name })}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {mode === "idle" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setMode("create")}
            disabled={isPending}
            className="min-h-9 rounded-xl bg-[#5B4FE9] px-4 text-sm font-semibold text-white transition hover:bg-[#4B3FE0] disabled:opacity-60"
          >
            {t("createNewCompany")}
          </button>
          <button
            onClick={openLinkMode}
            disabled={isPending}
            className="min-h-9 rounded-xl border border-[#5B4FE9]/25 bg-white px-4 text-sm font-semibold text-[#5B4FE9] transition hover:bg-[#5B4FE9]/5 disabled:opacity-60"
          >
            {t("linkToExisting")}
          </button>
          <button
            onClick={handleDiscard}
            disabled={isPending}
            className="min-h-9 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-500 transition hover:bg-gray-50 disabled:opacity-60"
          >
            {t("discard")}
          </button>
        </div>
      )}

      {mode === "create" && (
        <div className="mt-4 space-y-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("companyNamePlaceholder")}
            autoFocus
            className="min-h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#5B4FE9]/50 focus:ring-2 focus:ring-[#5B4FE9]/10"
          />
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t("domainPlaceholder")}
            className="min-h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#5B4FE9]/50 focus:ring-2 focus:ring-[#5B4FE9]/10"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={isPending || !name.trim()}
              className="min-h-9 rounded-xl bg-[#5B4FE9] px-4 text-sm font-semibold text-white transition hover:bg-[#4B3FE0] disabled:opacity-60"
            >
              {t("confirm")}
            </button>
            <button
              onClick={() => setMode("idle")}
              disabled={isPending}
              className="min-h-9 rounded-xl px-4 text-sm font-medium text-gray-500 hover:bg-gray-100"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {mode === "link" && (
        <div className="mt-4 space-y-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <input
            value={linkQuery}
            onChange={(e) => setLinkQuery(e.target.value)}
            placeholder={t("searchCompaniesPlaceholder")}
            autoFocus
            className="min-h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#5B4FE9]/50 focus:ring-2 focus:ring-[#5B4FE9]/10"
          />
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {companyList === null && <p className="px-1 py-2 text-xs text-gray-400">{t("loading")}</p>}
            {companyList !== null &&
              filteredCompanies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleLink(c.id)}
                  disabled={isPending}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-white disabled:opacity-50"
                >
                  {c.name}
                </button>
              ))}
            {companyList !== null && filteredCompanies.length === 0 && (
              <p className="px-1 py-2 text-xs text-gray-400">{t("noMatches")}</p>
            )}
          </div>
          <button
            onClick={() => setMode("idle")}
            disabled={isPending}
            className="min-h-9 rounded-xl px-4 text-sm font-medium text-gray-500 hover:bg-gray-100"
          >
            {t("cancel")}
          </button>
        </div>
      )}
    </motion.div>
  );
}

export function QuarantineClient({ initialItems }: { initialItems: QuarantineDisplayItem[] }) {
  const [items, setItems] = useState(initialItems);

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {items.map((item) => (
          <QuarantineCard
            key={item.id}
            item={item}
            onResolved={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
          />
        ))}
      </AnimatePresence>
      {items.length === 0 && <EmptyState />}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { loadCompanyOverlay } from "./actions";
import { CopyEmail } from "@/components/copy-email";
import { channelLabel } from "@/i18n/channel-labels";
import type { CompanyDetail, ProspectDetail } from "../companies/[id]/queries";

const STAGE_COLORS: Record<string, string> = {
  Won: "bg-green-100 text-green-700",
  Lost: "bg-gray-200 text-gray-600",
};

function fmtDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function fmtDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function ProspectSections({ prospect }: { prospect: ProspectDetail }) {
  const t = useTranslations("companyDetail");
  const tStage = useTranslations("stages");
  const tActor = useTranslations("actorType");
  const tTaskStatus = useTranslations("taskStatus");
  const tInterType = useTranslations("interactionType");
  const tInterDir = useTranslations("interactionDirection");
  const locale = useLocale();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{t("stageHistory")}</h3>
        <ol className="mt-3 space-y-3">
          {prospect.transitions.map((tr, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B4FE9]" />
              <div>
                <p className="text-gray-800">
                  {tr.fromStage
                    ? t("transition", { from: tStage(tr.fromStage), to: tStage(tr.toStage) })
                    : t("createdAs", { stage: tStage(tr.toStage) })}
                </p>
                <p className="text-xs text-gray-400">
                  {fmtDateTime(tr.occurredAt, locale)} · {tActor(tr.actorType)}
                </p>
              </div>
            </li>
          ))}
          {prospect.transitions.length === 0 && <p className="text-sm text-gray-400">{t("noStageHistory")}</p>}
        </ol>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{t("tasks")}</h3>
        <ul className="mt-3 space-y-2">
          {prospect.tasks.map((task) => (
            <li key={task.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className={task.status === "open" ? "text-gray-800" : "text-gray-400 line-through"}>{task.title}</p>
                <p className="text-xs text-gray-400">
                  {t("due", { date: fmtDate(task.dueDate, locale) })} · {task.assigneeName ?? t("unassigned")}
                </p>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                  (task.status === "open"
                    ? "bg-amber-100 text-amber-700"
                    : task.status === "done"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500")
                }
              >
                {tTaskStatus(task.status)}
              </span>
            </li>
          ))}
          {prospect.tasks.length === 0 && <p className="text-sm text-gray-400">{t("noTasks")}</p>}
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:col-span-2">
        <h3 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{t("interactions")}</h3>
        <ul className="mt-3 space-y-2">
          {prospect.interactions.map((i) => (
            <li key={i.id} className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-gray-800">{i.subject ?? tInterType(i.type)}</span>
                <span className="text-xs text-gray-400">{fmtDateTime(i.occurredAt, locale)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {tInterType(i.type)}
                {i.direction ? ` · ${tInterDir(i.direction)}` : ""}
                {i.contactName ? ` · ${i.contactName}` : ""}
              </p>
            </li>
          ))}
          {prospect.interactions.length === 0 && <p className="text-sm text-gray-400">{t("noInteractions")}</p>}
        </ul>
      </section>
    </div>
  );
}

export function CompanyOverlay({
  companyId,
  matchedContact,
  onClose,
}: {
  companyId: string;
  matchedContact?: { name: string | null; email: string } | null;
  onClose: () => void;
}) {
  const t = useTranslations("companyDetail");
  const tChannel = useTranslations("channels");
  const tStage = useTranslations("stages");
  const locale = useLocale();

  // The loaded id is carried in the state itself rather than reset by a
  // synchronous setState at the top of the effect: that reset re-rendered
  // every mount for no reason, and while a stale result was in flight the
  // overlay would briefly show the previous company's data.
  const [loaded, setLoaded] = useState<
    | { id: string; status: "ok"; data: CompanyDetail }
    | { id: string; status: "error" }
    | { id: string; status: "not_found" }
    | null
  >(null);
  const state = loaded?.id === companyId ? loaded : ({ status: "loading" } as const);

  useEffect(() => {
    let cancelled = false;
    loadCompanyOverlay(companyId).then((result) => {
      if (cancelled) return;
      if (result.state === "ok") setLoaded({ id: companyId, status: "ok", data: result.data });
      else if (result.state === "not_found") setLoaded({ id: companyId, status: "not_found" });
      else setLoaded({ id: companyId, status: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const primaryProspect = state.status === "ok" ? state.data.prospects[0] : undefined;

  const featuredContact: { name: string | null; email: string; title: string | null } | null =
    state.status === "ok"
      ? matchedContact
        ? (() => {
            const known = state.data.contacts.find((c) => c.email === matchedContact.email);
            return known ?? { name: matchedContact.name, email: matchedContact.email, title: null };
          })()
        : (state.data.contacts[0] ?? null)
      : null;

  // Opacity only — deliberately no rotateY here. This sits inside an element
  // doing a layoutId projection, which rewrites `transform` every frame to
  // morph the card into the panel; a 3D rotation on the child fights it and
  // the content shears diagonally across the grid mid-transition. Fading the
  // contents lets the projection own the movement, which is the effect that
  // actually reads.
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="h-full w-full overflow-y-auto rounded-[28px] border border-gray-100 bg-[#FBFAFF] shadow-2xl"
    >
      <div className="mx-auto max-w-3xl px-5 py-5 sm:px-8 sm:py-7">
        <button
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-[#5B4FE9] sm:min-h-0"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          {t("back")}
        </button>

        {state.status === "loading" && (
          <div className="mt-8 animate-pulse space-y-4">
            <div className="h-9 w-64 rounded bg-gray-100" />
            <div className="h-24 rounded-2xl bg-white shadow-sm" />
            <div className="h-40 rounded-2xl bg-white shadow-sm" />
          </div>
        )}

        {state.status === "not_found" && (
          <p className="mt-8 rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">{t("notFound")}</p>
        )}

        {state.status === "error" && (
          <p className="mt-8 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{t("loadError")}</p>
        )}

        {state.status === "ok" && (
          <div className="mt-4">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{state.data.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {primaryProspect && (
                <span
                  className={
                    "rounded-full px-3 py-1 text-xs font-semibold " +
                    (STAGE_COLORS[primaryProspect.currentStage] ?? "bg-[#5B4FE9]/10 text-[#5B4FE9]")
                  }
                >
                  {tStage(primaryProspect.currentStage)}
                </span>
              )}
              {primaryProspect && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {channelLabel(tChannel, primaryProspect.channel)}
                </span>
              )}
              {state.data.domain && <span className="text-sm text-gray-400">{state.data.domain}</span>}
            </div>

            {primaryProspect && (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricBlock label={t("stage")} value={tStage(primaryProspect.currentStage)} />
                <MetricBlock label={t("channel")} value={channelLabel(tChannel, primaryProspect.channel)} />
                <MetricBlock label={t("owner")} value={primaryProspect.ownerName ?? t("unassigned")} />
                <MetricBlock label={t("created")} value={fmtDate(primaryProspect.createdAt, locale)} />
              </div>
            )}

            {featuredContact && (
              <div className="mt-5 flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#5B4FE9] text-sm font-semibold text-white">
                  {initialsOf(featuredContact.name ?? featuredContact.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{featuredContact.name ?? featuredContact.email}</span>
                    {featuredContact.title && (
                      <span className="text-sm text-gray-400">· {featuredContact.title}</span>
                    )}
                  </p>
                  <CopyEmail email={featuredContact.email} className="mt-0.5 max-w-full text-sm text-gray-500" />
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  {t("knownContact")}
                </span>
              </div>
            )}

            {matchedContact && (
              <p className="mt-2 text-xs text-gray-400">
                {t("matchedVia", { name: matchedContact.name ?? matchedContact.email })}
              </p>
            )}

            <div className="mt-6 space-y-6">
              {state.data.prospects.map((p) => (
                <ProspectSections key={p.id} prospect={p} />
              ))}
              {state.data.prospects.length === 0 && <p className="text-sm text-gray-400">{t("noProspect")}</p>}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

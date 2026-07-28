"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { loadCompanyOverlay } from "./actions";
import type { CompanyDetail, ProspectDetail } from "../companies/[id]/queries";

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

function fmtDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function fmtDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
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
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Stage history</h3>
        <ol className="mt-3 space-y-3">
          {prospect.transitions.map((t, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B4FE9]" />
              <div>
                <p className="text-gray-800">{t.fromStage ? `${t.fromStage} → ${t.toStage}` : `Created as ${t.toStage}`}</p>
                <p className="text-xs text-gray-400">
                  {fmtDateTime(t.occurredAt)} · {t.actorType}
                </p>
              </div>
            </li>
          ))}
          {prospect.transitions.length === 0 && <p className="text-sm text-gray-400">No stage history yet.</p>}
        </ol>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Tasks</h3>
        <ul className="mt-3 space-y-2">
          {prospect.tasks.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className={t.status === "open" ? "text-gray-800" : "text-gray-400 line-through"}>{t.title}</p>
                <p className="text-xs text-gray-400">
                  Due {fmtDate(t.dueDate)} · {t.assigneeName ?? "Unassigned"}
                </p>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                  (t.status === "open"
                    ? "bg-amber-100 text-amber-700"
                    : t.status === "done"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500")
                }
              >
                {t.status}
              </span>
            </li>
          ))}
          {prospect.tasks.length === 0 && <p className="text-sm text-gray-400">No tasks.</p>}
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:col-span-2">
        <h3 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Interactions</h3>
        <ul className="mt-3 space-y-2">
          {prospect.interactions.map((i) => (
            <li key={i.id} className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-gray-800">{i.subject ?? i.type}</span>
                <span className="text-xs text-gray-400">{fmtDateTime(i.occurredAt)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {i.type}
                {i.direction ? ` · ${i.direction}` : ""}
                {i.contactName ? ` · ${i.contactName}` : ""}
              </p>
            </li>
          ))}
          {prospect.interactions.length === 0 && <p className="text-sm text-gray-400">No interactions logged yet.</p>}
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
  const [state, setState] = useState<
    { status: "loading" } | { status: "ok"; data: CompanyDetail } | { status: "error" } | { status: "not_found" }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadCompanyOverlay(companyId).then((result) => {
      if (cancelled) return;
      if (result.state === "ok") setState({ status: "ok", data: result.data });
      else if (result.state === "not_found") setState({ status: "not_found" });
      else setState({ status: "error" });
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

  return (
    <motion.div
      initial={{ rotateY: -90, opacity: 0.4 }}
      animate={{ rotateY: 0, opacity: 1 }}
      exit={{ rotateY: 90, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformPerspective: 1400 }}
      className="h-full w-full overflow-y-auto rounded-[28px] border border-gray-100 bg-[#FBFAFF] shadow-2xl"
    >
      <div className="mx-auto max-w-3xl px-5 py-5 sm:px-8 sm:py-7">
        <button
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-[#5B4FE9] sm:min-h-0"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back
        </button>

        {state.status === "loading" && (
          <div className="mt-8 animate-pulse space-y-4">
            <div className="h-9 w-64 rounded bg-gray-100" />
            <div className="h-24 rounded-2xl bg-white shadow-sm" />
            <div className="h-40 rounded-2xl bg-white shadow-sm" />
          </div>
        )}

        {state.status === "not_found" && (
          <p className="mt-8 rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
            We couldn&apos;t find that company.
          </p>
        )}

        {state.status === "error" && (
          <p className="mt-8 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
            Couldn&apos;t load this company right now. Try again.
          </p>
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
                  {primaryProspect.currentStage}
                </span>
              )}
              {primaryProspect && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {CHANNEL_LABELS[primaryProspect.channel] ?? primaryProspect.channel}
                </span>
              )}
              {state.data.domain && <span className="text-sm text-gray-400">{state.data.domain}</span>}
            </div>

            {primaryProspect && (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricBlock label="Stage" value={primaryProspect.currentStage} />
                <MetricBlock label="Channel" value={CHANNEL_LABELS[primaryProspect.channel] ?? primaryProspect.channel} />
                <MetricBlock label="Owner" value={primaryProspect.ownerName ?? "Unassigned"} />
                <MetricBlock label="Created" value={fmtDate(primaryProspect.createdAt)} />
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
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-gray-500">
                    <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    {featuredContact.email}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  Known contact
                </span>
              </div>
            )}

            {matchedContact && (
              <p className="mt-2 text-xs text-gray-400">Matched via: {matchedContact.name ?? matchedContact.email}</p>
            )}

            <div className="mt-6 space-y-6">
              {state.data.prospects.map((p) => (
                <ProspectSections key={p.id} prospect={p} />
              ))}
              {state.data.prospects.length === 0 && (
                <p className="text-sm text-gray-400">No prospect record for this company yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

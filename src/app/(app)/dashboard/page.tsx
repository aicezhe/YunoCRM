import { Suspense } from "react";
import { eq } from "drizzle-orm";
import {
  BarChart3,
  Calendar,
  Clock,
  Mail,
  Phone,
  Radio,
  StickyNote,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/db";
import { users } from "../../../../drizzle/schema";
import { createClient } from "@/lib/supabase/server";
import { SectionCard, type WashVariant } from "./section-card";
import { getDataAsOf, getRecentActivity } from "./metrics";
import { relativeTime } from "./relative-time";

const SECTIONS: { href: string; title: string; icon: LucideIcon; wash: WashVariant }[] = [
  { href: "/dashboard/source", title: "Source", icon: Radio, wash: "top-right" },
  { href: "/dashboard/by-stage", title: "By stage", icon: BarChart3, wash: "bottom-right" },
  { href: "/dashboard/time", title: "Time", icon: Clock, wash: "bottom-left" },
  { href: "/dashboard/withering", title: "Withering", icon: TrendingDown, wash: "right-center" },
];

const TYPE_ICON: Record<string, LucideIcon> = { email: Mail, call: Phone, meeting: Calendar, note: StickyNote };
const TYPE_LABEL: Record<string, string> = { email: "email", call: "call", meeting: "meeting", note: "note" };

/** Prefers the team member's real name; falls back to the email local part. */
async function getGreetingName(email: string | undefined): Promise<string> {
  if (!email) return "there";
  try {
    const [row] = await db.select({ name: users.name }).from(users).where(eq(users.email, email));
    if (row?.name) return row.name.split(" ")[0];
  } catch (err) {
    console.error("[dashboard] name lookup failed:", err);
  }
  return email.split("@")[0];
}

async function AsOfNote() {
  const asOf = await getDataAsOf();
  if (!asOf) return null;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(asOf));
  return <p className="mt-1 text-sm text-gray-400">Pipeline data as of {formatted}</p>;
}

async function RecentActivity() {
  const [report, asOf] = await Promise.all([getRecentActivity(5), getDataAsOf()]);

  if (report.state === "error") {
    return (
      <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
        Couldn&apos;t load recent activity right now.
      </p>
    );
  }
  if (report.state === "empty") {
    return (
      <p className="rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">
        No interactions logged yet — they&apos;ll show up here as they come in.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)]">
      {report.items.map((item) => {
        const Icon = TYPE_ICON[item.type] ?? StickyNote;
        const label = TYPE_LABEL[item.type] ?? item.type;
        return (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5B4FE9]/10 text-[#5B4FE9]">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
              <span className="font-medium">{item.companyName}</span>
              <span className="text-gray-400"> — {item.direction ? `${item.direction} ` : ""}{label}</span>
            </span>
            <span className="shrink-0 text-xs text-gray-400">
              {asOf ? relativeTime(item.occurredAt, new Date(asOf).toISOString()) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RecentActivitySkeleton() {
  return (
    <div className="animate-pulse space-y-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-8 rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = await getGreetingName(user?.email);

  return (
    <div className="mx-auto max-w-5xl px-5 sm:px-6">
      <div className="pt-6 pb-8 sm:pt-8 sm:pb-10">
        <h1 className="text-3xl font-semibold tracking-tight break-words text-gray-900 sm:text-4xl lg:text-5xl">
          Hello, {name}
        </h1>
        <Suspense fallback={null}>
          <AsOfNote />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {SECTIONS.map((section) => (
          <SectionCard
            key={section.href}
            href={section.href}
            title={section.title}
            icon={section.icon}
            wash={section.wash}
          />
        ))}
      </div>

      <div className="mt-8 mb-12 sm:mt-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">Recent activity</h2>
        <Suspense fallback={<RecentActivitySkeleton />}>
          <RecentActivity />
        </Suspense>
      </div>
    </div>
  );
}

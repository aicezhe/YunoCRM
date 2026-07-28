import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { BarChart3, Clock, Radio, TrendingDown, type LucideIcon } from "lucide-react";
import { db } from "@/db";
import { users } from "../../../drizzle/schema";
import { createClient } from "@/lib/supabase/server";
import { MetricCard, MetricCardSkeleton } from "./metric-card";
import {
  getDataAsOf,
  getSourceMetric,
  getStageMetric,
  getTimeMetric,
  getWitheringMetric,
  type Metric,
} from "./metrics";
import { SignOutButton } from "./sign-out-button";

interface CardDef {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  load: () => Promise<Metric>;
}

const CARDS: CardDef[] = [
  {
    href: "/dashboard/source",
    title: "Source",
    description: "Where prospects come from",
    icon: Radio,
    load: getSourceMetric,
  },
  {
    href: "/dashboard/by-stage",
    title: "By stage",
    description: "Distribution across the funnel",
    icon: BarChart3,
    load: getStageMetric,
  },
  {
    href: "/dashboard/time",
    title: "Time",
    description: "How long each stage takes",
    icon: Clock,
    load: getTimeMetric,
  },
  {
    href: "/dashboard/withering",
    title: "Withering",
    description: "Prospects going quiet",
    icon: TrendingDown,
    load: getWitheringMetric,
  },
];

/** Streams in once its own query resolves, so each card loads independently. */
async function AsyncMetricCard({ card }: { card: CardDef }) {
  const metric = await card.load();
  return (
    <MetricCard
      href={card.href}
      title={card.title}
      description={card.description}
      icon={card.icon}
      metric={metric}
    />
  );
}

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
  return <p className="mt-3 text-sm text-gray-400">Pipeline data as of {formatted}</p>;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = await getGreetingName(user?.email);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#EEEBFF] via-[#F7F5FF] to-white font-sans">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-xl font-semibold tracking-tight text-[#5B4FE9]">
          Yuno<span className="text-gray-900">CRM</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-gray-500 sm:inline">{user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="pt-8 pb-10">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Hello, {name}
          </h1>
          <Suspense fallback={null}>
            <AsOfNote />
          </Suspense>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {CARDS.map((card) => (
            <Suspense
              key={card.href}
              fallback={
                <MetricCardSkeleton
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                />
              }
            >
              <AsyncMetricCard card={card} />
            </Suspense>
          ))}
        </div>
      </div>
    </main>
  );
}

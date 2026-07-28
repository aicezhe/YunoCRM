import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { BarChart3, Clock, Radio, TrendingDown, type LucideIcon } from "lucide-react";
import { db } from "@/db";
import { users } from "../../../../drizzle/schema";
import { createClient } from "@/lib/supabase/server";
import { SectionCard } from "./section-card";
import { getDataAsOf } from "./metrics";

const SECTIONS: { href: string; title: string; icon: LucideIcon }[] = [
  { href: "/dashboard/source", title: "Source", icon: Radio },
  { href: "/dashboard/by-stage", title: "By stage", icon: BarChart3 },
  { href: "/dashboard/time", title: "Time", icon: Clock },
  { href: "/dashboard/withering", title: "Withering", icon: TrendingDown },
];

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
          <SectionCard key={section.href} href={section.href} title={section.title} icon={section.icon} />
        ))}
      </div>
    </div>
  );
}

import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { BarChart3, Clock, Radio, TrendingDown, type LucideIcon } from "lucide-react";
import { db } from "@/db";
import { users } from "../../../drizzle/schema";
import { createClient } from "@/lib/supabase/server";
import { SectionCard } from "./section-card";
import { getDataAsOf } from "./metrics";
import { SignOutButton } from "./sign-out-button";

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
    <main className="min-h-dvh bg-gradient-to-br from-[#EEEBFF] via-[#F7F5FF] to-white font-sans">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5 sm:px-6 sm:py-6">
        <span className="text-lg font-semibold tracking-tight text-[#5B4FE9] sm:text-xl">
          Yuno<span className="text-gray-900">CRM</span>
        </span>
        <div className="flex items-center gap-4">
          {/* The email is the first thing to go when width is scarce. */}
          <span className="hidden truncate text-sm text-gray-500 sm:inline">{user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-16 sm:px-6 sm:pb-20">
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
            />
          ))}
        </div>
      </div>
    </main>
  );
}

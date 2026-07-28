import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

/** Shared placeholder for the four dashboard sub-screens, built in a later step. */
export function ComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#EEEBFF] via-[#F7F5FF] to-white font-sans">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-[#5B4FE9]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Dashboard
        </Link>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5B4FE9]/10 text-[#5B4FE9]">
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-gray-900">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-gray-500">{description}</p>
        <p className="mt-8 rounded-full bg-white/70 px-4 py-2 text-sm text-gray-400 shadow-sm">
          Coming soon
        </p>
      </div>
    </main>
  );
}

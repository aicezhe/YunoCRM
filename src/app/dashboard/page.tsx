import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

// Placeholder — the real dashboard is a later step; this page exists as the
// post-login landing target and to prove route protection works.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-[#EEEBFF] via-[#F7F5FF] to-white font-sans">
      <header className="flex items-center justify-between px-8 py-5">
        <span className="text-xl font-semibold tracking-tight text-[#5B4FE9]">
          Yuno<span className="text-gray-900">CRM</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <SignOutButton />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center">
        <div className="rounded-3xl bg-white/80 px-12 py-10 text-center shadow-[0_20px_60px_-15px_rgba(91,79,233,0.25)] backdrop-blur-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-500">Coming soon — you are logged in.</p>
        </div>
      </div>
    </main>
  );
}

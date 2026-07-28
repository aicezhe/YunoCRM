"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // min-h-11 holds the tap target at 44px on touch screens; from sm up the
  // padding alone is enough and the button goes back to its compact size.
  return (
    <button
      onClick={handleSignOut}
      className="min-h-11 shrink-0 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-[#5B4FE9]/40 hover:text-[#5B4FE9] sm:min-h-0"
    >
      Sign out
    </button>
  );
}

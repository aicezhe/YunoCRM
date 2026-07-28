import { createBrowserClient } from "@supabase/ssr";

/** Browser-side Supabase client — used by client components (login form, sign-out). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

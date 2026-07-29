"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "./locales";

/**
 * Persists the chosen UI locale. Revalidating the whole layout tree is what
 * lets the switch apply without a full page reload: every Server Component
 * re-renders with the new messages while the client stays on the same route.
 */
export async function setLocale(value: string): Promise<void> {
  if (!isLocale(value)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getAllUsers } from "./queries";
import { UsersClient } from "./users-client";

/** Admin-only, matching the BottomNav visibility rule — enforced here too in
 * case someone hits the URL directly instead of clicking the (hidden) tab. */
export default async function UsersPage() {
  // Cached alongside the layout's own call — see src/lib/auth/current-user.ts.
  const [appUser, allUsers, t] = await Promise.all([
    getCurrentAppUser(),
    getAllUsers(),
    getTranslations("users"),
  ]);
  if (appUser?.role !== "admin") redirect("/dashboard?denied=users");

  return (
    <>
      <div className="mx-auto max-w-3xl px-5 pt-6 sm:px-6 sm:pt-8">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-xl text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="mx-auto max-w-3xl px-5 pt-6 pb-4 sm:px-6">
        <UsersClient initialUsers={allUsers} />
      </div>
    </>
  );
}

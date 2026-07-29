import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { users } from "../../../../drizzle/schema";
import { createClient } from "@/lib/supabase/server";
import { getAllUsers } from "./queries";
import { UsersClient } from "./users-client";

/** Admin-only, matching the BottomNav visibility rule — enforced here too in
 * case someone hits the URL directly instead of clicking the (hidden) tab. */
export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [row] = user?.email
    ? await db.select({ role: users.role }).from(users).where(eq(users.email, user.email))
    : [];
  if (row?.role !== "admin") redirect("/dashboard?denied=users");

  const allUsers = await getAllUsers();

  return (
    <>
      <div className="mx-auto max-w-3xl px-5 pt-4 sm:px-6 sm:pt-6">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-[#5B4FE9] sm:min-h-0"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">Users</h1>
        <p className="mt-2 max-w-xl text-sm text-gray-500">Manage team members, roles, and who owns what.</p>
      </div>

      <div className="mx-auto max-w-3xl px-5 pt-6 pb-4 sm:px-6">
        <UsersClient initialUsers={allUsers} />
      </div>
    </>
  );
}

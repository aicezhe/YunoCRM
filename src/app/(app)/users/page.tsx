import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
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
      <div className="mx-auto max-w-3xl px-5 pt-6 sm:px-6 sm:pt-8">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">Users</h1>
        <p className="mt-2 max-w-xl text-sm text-gray-500">Manage team members, roles, and who owns what.</p>
      </div>

      <div className="mx-auto max-w-3xl px-5 pt-6 pb-4 sm:px-6">
        <UsersClient initialUsers={allUsers} />
      </div>
    </>
  );
}

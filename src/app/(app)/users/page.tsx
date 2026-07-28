import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Users as UsersIcon } from "lucide-react";
import { db } from "@/db";
import { users } from "../../../../drizzle/schema";
import { createClient } from "@/lib/supabase/server";
import { ComingSoon } from "@/components/coming-soon";

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
  if (row?.role !== "admin") redirect("/dashboard");

  return (
    <ComingSoon
      title="Users"
      description="Manage team members, roles, and who owns what."
      icon={UsersIcon}
    />
  );
}

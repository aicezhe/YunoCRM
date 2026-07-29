import { desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "../../../../drizzle/schema";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: string;
};

export async function getAllUsers(): Promise<UserRow[]> {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  return rows.map((r) => ({ ...r, role: r.role as "admin" | "member" }));
}

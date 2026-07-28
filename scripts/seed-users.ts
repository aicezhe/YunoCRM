/**
 * Seeds the 5 login accounts into Supabase Auth and syncs them with the
 * `users` table, so prospects' owner_id (set by resolve.ts from the
 * dataset's team block) points at people who can actually log in.
 *
 * 4 accounts mirror the dataset's team (data/yuno-crm-seed-data.json →
 * team[]); the 5th (admin@yunoai.io) is a standalone demo-admin account
 * that is deliberately NOT part of the dataset, so user-management can be
 * demonstrated without touching real team data.
 *
 * All accounts share one throwaway test password, printed at the end —
 * this is a take-home demo fixture, not a production credential scheme.
 *
 * Idempotent: existing auth users are skipped (not failed on), and the
 * users table is upserted by email, updating name/role to match this list.
 *
 * Run: npm run seed-users   (requires SUPABASE_SERVICE_ROLE_KEY in .env.local)
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { db, client } from "../src/db";
import { users } from "../drizzle/schema";

const TEST_PASSWORD = "YunoCRM2026!";

// Emails match data/yuno-crm-seed-data.json team[] exactly (verified).
// Roles per the project owner's spec: Giulia + Marco admins, Sara + Luca
// members — note Marco is admin here even though resolve.ts's CEO-only
// heuristic seeded him as member; the upsert below corrects that.
const SEED_USERS: { email: string; name: string; role: "admin" | "member" }[] = [
  { email: "giulia@yunoai.io", name: "Giulia Ferraro", role: "admin" },
  { email: "marco@yunoai.io", name: "Marco Bianchi", role: "admin" },
  { email: "sara@yunoai.io", name: "Sara Colombo", role: "member" },
  { email: "luca@yunoai.io", name: "Luca Greco", role: "member" },
  { email: "admin@yunoai.io", name: "Demo Admin", role: "admin" },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — check .env.local");
  }

  const admin = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const u of SEED_USERS) {
    // --- Supabase Auth ---------------------------------------------------
    const { error } = await admin.auth.admin.createUser({
      email: u.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      if (error.code === "email_exists") {
        console.log(`[auth ] ${u.email}: already exists, skipped`);
      } else {
        throw new Error(`auth.admin.createUser(${u.email}) failed: ${error.message}`);
      }
    } else {
      console.log(`[auth ] ${u.email}: created`);
    }

    // --- users table (upsert by email, sync name + role) ----------------
    await db
      .insert(users)
      .values({ email: u.email, name: u.name, role: u.role })
      .onConflictDoUpdate({
        target: users.email,
        set: { name: u.name, role: u.role },
      });
    console.log(`[users] ${u.email}: synced (${u.role})`);
  }

  console.log("\n=== Demo credentials (shared test password) ===");
  for (const u of SEED_USERS) {
    console.log(`  ${u.email.padEnd(22)} ${u.role.padEnd(7)} ${TEST_PASSWORD}`);
  }
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });

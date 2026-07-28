import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";
import * as relations from "../../drizzle/relations";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — check .env.local");
}

// Next.js re-evaluates modules on every hot reload; without this cache each
// reload would open a fresh pool and exhaust Supabase's connection limit
// during a dev session. Standalone scripts get a plain client either way.
const globalForDb = globalThis as unknown as { _pgClient?: postgres.Sql };

// `prepare: false` is required when DATABASE_URL points at Supabase's
// transaction-mode pooler (pgbouncer/Supavisor, port 6543) — the pooler
// doesn't guarantee a prepared statement survives to the connection that
// executes it, since it can hand out a different underlying connection per
// query. Without this, queries intermittently fail in serverless
// deployments (each invocation is a fresh connection) while working fine
// locally against a single long-lived direct connection.
export const client = globalForDb._pgClient ?? postgres(process.env.DATABASE_URL, { max: 5, prepare: false });

if (process.env.NODE_ENV !== "production") globalForDb._pgClient = client;

export const db = drizzle(client, { schema: { ...schema, ...relations } });

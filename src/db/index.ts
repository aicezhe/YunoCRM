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

export const client = globalForDb._pgClient ?? postgres(process.env.DATABASE_URL, { max: 5 });

if (process.env.NODE_ENV !== "production") globalForDb._pgClient = client;

export const db = drizzle(client, { schema: { ...schema, ...relations } });

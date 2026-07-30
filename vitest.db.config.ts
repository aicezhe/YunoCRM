import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Reads the same .env.local the app and the pipeline scripts use, so
 * DATABASE_URL never has to be duplicated for tests. Deliberately hand-rolled
 * rather than pulling in dotenv: it needs to understand `KEY=value`,
 * comments, and blank lines, and nothing else.
 */
function loadEnvLocal(): Record<string, string> {
  const file = path.resolve(__dirname, ".env.local");
  if (!fs.existsSync(file)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

/**
 * Integration run: only `*.db.test.ts`, against a real Postgres holding the
 * seeded fixture. Kept out of `npm test` because it needs DATABASE_URL and a
 * network round-trip per query.
 *
 * Single-threaded on purpose — these tests share one connection pool and
 * assert on aggregates over the whole table, so running files in parallel
 * would buy nothing and make failures harder to read.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["**/*.db.test.ts"],
    env: loadEnvLocal(),
    // One file at a time: these share a connection pool and assert on
    // whole-table aggregates, so parallelism buys nothing and muddies
    // failures.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});

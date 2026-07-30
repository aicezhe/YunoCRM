import { defineConfig } from "vitest/config";

/**
 * The default run is the fast one: pure logic, no database, no network, so
 * `npm test` stays usable as a tight loop and in CI without secrets.
 *
 * The dashboard aggregates can't be covered that way — they ARE SQL, and
 * reimplementing them in TypeScript to unit-test them would test the copy
 * rather than the query that ships. Those live in `*.db.test.ts` and run via
 * `npm run test:db` against a database with the seeded fixture loaded.
 */
export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/*.db.test.ts"],
  },
});

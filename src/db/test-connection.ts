import { sql } from "drizzle-orm";
import { db } from "./index";
import { companies } from "../../drizzle/schema";

async function main() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(companies);
  console.log(`companies row count: ${count}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Connection test failed:", err);
  process.exit(1);
});

/**
 * Raw ingestion — copies data/yuno-crm-seed-data.json into raw_events as-is.
 *
 * No classification, filtering, or company resolution happens here — that's
 * a separate script. This only stages every email/calendar_event record
 * into raw_events so nothing from the source file is ever lost.
 *
 * Idempotent: relies on raw_events' UNIQUE(source, external_id) constraint
 * (migration 0004) via onConflictDoNothing — re-running is always safe.
 *
 * Run: npm run ingest
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db, client } from "../src/db";
import { rawEvents } from "../drizzle/schema";

interface EmailRecord {
  message_id: string;
  thread_id: string;
  timestamp: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

interface CalendarEvent {
  event_id: string;
  title: string;
  start: string;
  end: string;
  organizer: string;
  attendees: string[];
  location: string;
  description: string;
  status: string;
}

interface SeedData {
  meta: unknown;
  team: unknown[];
  emails: EmailRecord[];
  calendar_events: CalendarEvent[];
}

const DATA_PATH = join(process.cwd(), "data", "yuno-crm-seed-data.json");
const data: SeedData = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

async function ingestEmails() {
  const values = data.emails.map((email) => ({
    source: "email" as const,
    externalId: email.message_id,
    payload: email,
    status: "pending" as const,
  }));

  const inserted = await db
    .insert(rawEvents)
    .values(values)
    .onConflictDoNothing({ target: [rawEvents.source, rawEvents.externalId] })
    .returning({ externalId: rawEvents.externalId });

  return { processed: values.length, inserted: inserted.length };
}

async function ingestCalendarEvents() {
  const values = data.calendar_events.map((event) => ({
    source: "calendar" as const,
    externalId: event.event_id,
    payload: event,
    status: "pending" as const,
  }));

  const inserted = await db
    .insert(rawEvents)
    .values(values)
    .onConflictDoNothing({ target: [rawEvents.source, rawEvents.externalId] })
    .returning({ externalId: rawEvents.externalId });

  return { processed: values.length, inserted: inserted.length };
}

async function main() {
  const emailResult = await ingestEmails();
  const eventResult = await ingestCalendarEvents();

  console.log("\n=== Ingestion summary ===");
  console.log(
    `Emails:    processed ${emailResult.processed}, inserted ${emailResult.inserted}, skipped (already existed) ${
      emailResult.processed - emailResult.inserted
    }`
  );
  console.log(
    `Events:    processed ${eventResult.processed}, inserted ${eventResult.inserted}, skipped (already existed) ${
      eventResult.processed - eventResult.inserted
    }`
  );
  console.log(
    `Total:     processed ${emailResult.processed + eventResult.processed}, inserted ${
      emailResult.inserted + eventResult.inserted
    }, skipped ${
      emailResult.processed - emailResult.inserted + (eventResult.processed - eventResult.inserted)
    }`
  );
}

main()
  .catch((err) => {
    console.error("Ingestion failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });

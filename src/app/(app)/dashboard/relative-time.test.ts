import { describe, expect, it } from "vitest";
import { relativeTime } from "./relative-time";

const ASOF = "2026-07-09T12:00:00Z";

// These assertions moved from hand-built strings ("3d ago") to whatever
// Intl.RelativeTimeFormat produces per locale. That is the point of the
// change: Russian needs three plural forms and the platform already has
// them, so the exact wording is now the runtime's to decide, not ours.
describe("relativeTime (English)", () => {
  it("reads as 'now' for sub-minute gaps", () => {
    expect(relativeTime("2026-07-09T11:59:45Z", ASOF)).toBe("now");
  });

  it("formats minutes", () => {
    expect(relativeTime("2026-07-09T11:45:00Z", ASOF)).toBe("15 min. ago");
  });

  it("formats hours once past 60 minutes", () => {
    expect(relativeTime("2026-07-09T09:00:00Z", ASOF)).toBe("3 hr. ago");
  });

  it("formats days once past 24 hours", () => {
    expect(relativeTime("2026-07-06T12:00:00Z", ASOF)).toBe("3 days ago");
  });

  it("formats months once past 30 days", () => {
    expect(relativeTime("2026-05-01T12:00:00Z", ASOF)).toBe("2 mo. ago");
  });
});

describe("relativeTime (Russian plural forms)", () => {
  // The reason the hand-rolled version had to go: "1 день / 2 дня / 5 дней"
  // are three different forms, and picking between them by hand is exactly
  // the kind of thing Intl does correctly for every locale.
  it("uses the singular form for one day", () => {
    expect(relativeTime("2026-07-08T12:00:00Z", ASOF, "ru")).toBe("вчера");
  });

  it("uses the 'few' form for two to four days", () => {
    expect(relativeTime("2026-07-06T12:00:00Z", ASOF, "ru")).toBe("3 дн. назад");
  });

  it("uses the 'many' form from five days up", () => {
    expect(relativeTime("2026-07-02T12:00:00Z", ASOF, "ru")).toBe("7 дн. назад");
  });
});

describe("relativeTime (Italian)", () => {
  it("formats days in Italian", () => {
    expect(relativeTime("2026-07-06T12:00:00Z", ASOF, "it")).toBe("3 gg fa");
  });
});

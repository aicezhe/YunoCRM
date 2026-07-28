import { describe, expect, it } from "vitest";
import { relativeTime } from "./relative-time";

const ASOF = "2026-07-09T12:00:00Z";

describe("relativeTime", () => {
  it("reads as 'just now' for sub-minute gaps", () => {
    expect(relativeTime("2026-07-09T11:59:45Z", ASOF)).toBe("just now");
  });

  it("formats minutes", () => {
    expect(relativeTime("2026-07-09T11:45:00Z", ASOF)).toBe("15m ago");
  });

  it("formats hours once past 60 minutes", () => {
    expect(relativeTime("2026-07-09T09:00:00Z", ASOF)).toBe("3h ago");
  });

  it("formats days once past 24 hours", () => {
    expect(relativeTime("2026-07-06T12:00:00Z", ASOF)).toBe("3d ago");
  });

  it("formats months once past 30 days", () => {
    expect(relativeTime("2026-05-01T12:00:00Z", ASOF)).toBe("2mo ago");
  });
});

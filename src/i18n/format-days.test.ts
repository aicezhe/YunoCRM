import { describe, expect, it } from "vitest";
import { avgDaysKey } from "./format-days";

describe("avgDaysKey", () => {
  it("uses the fraction key for a non-integer Russian value", () => {
    // "13,7 дней" (plural) is wrong — Russian grammar wants the genitive
    // singular "13,7 дня" for any fractional quantity, regardless of size.
    expect(avgDaysKey(13.7, "ru")).toBe("avgDaysFraction");
    expect(avgDaysKey(1.1, "ru")).toBe("avgDaysFraction");
  });

  it("uses the normal plural key for an integer Russian value", () => {
    expect(avgDaysKey(1, "ru")).toBe("avgDays");
    expect(avgDaysKey(2, "ru")).toBe("avgDays");
    expect(avgDaysKey(5, "ru")).toBe("avgDays");
  });

  it("never special-cases English or Italian — their plural forms are already correct for decimals", () => {
    expect(avgDaysKey(13.7, "en")).toBe("avgDays");
    expect(avgDaysKey(13.7, "it")).toBe("avgDays");
    expect(avgDaysKey(1.1, "en")).toBe("avgDays");
  });
});

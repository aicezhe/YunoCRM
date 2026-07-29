import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanCompanyName, companyNameFromSubject, isPlaceholderCompanyName } from "./resolution-rules";
import type { EmailPayload } from "./classification-rules";

// Same policy as the classification tests: fixtures come from the real seed
// dataset, so these exercise the actual dirty records rather than invented ones.
const DATA_PATH = join(process.cwd(), "data", "yuno-crm-seed-data.json");
const seed: { emails: EmailPayload[] } = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

describe("cleanCompanyName", () => {
  it("strips the stray CJK character the seed data carries", () => {
    // "Meccatronica友 Robotics" appears verbatim in the dataset and was
    // reaching the companies table unchanged.
    const dirty = seed.emails.find((e) => e.subject.includes("Meccatronica友"));
    expect(dirty, "fixture subject with the mojibake company name").toBeDefined();
    expect(cleanCompanyName("Meccatronica友 Robotics")).toBe("Meccatronica Robotics");
  });

  it("leaves a clean Latin name untouched", () => {
    expect(cleanCompanyName("Fintech Borsa Lab")).toBe("Fintech Borsa Lab");
    expect(cleanCompanyName("Sicurezza & Vigilanza Group")).toBe("Sicurezza & Vigilanza Group");
  });

  it("keeps accented Latin characters", () => {
    expect(cleanCompanyName("Société Générale Italia")).toBe("Société Générale Italia");
  });

  it("does not mangle a genuinely non-Latin name", () => {
    // Guard against over-eager stripping: when the name is mostly non-Latin
    // it is the real name, not noise wedged into a Latin one.
    expect(cleanCompanyName("株式会社ロボティクス")).toBe("株式会社ロボティクス");
  });
});

describe("isPlaceholderCompanyName", () => {
  it("flags a name that is just the domain", () => {
    expect(isPlaceholderCompanyName("borsalab.io", "borsalab.io")).toBe(true);
    expect(isPlaceholderCompanyName("Capitalgate.eu", "capitalgate.eu")).toBe(true);
  });

  it("does not flag a real name", () => {
    expect(isPlaceholderCompanyName("Fintech Borsa Lab", "borsalab.io")).toBe(false);
  });

  it("is false when there is no domain to compare against", () => {
    expect(isPlaceholderCompanyName("Cliente di Andrea Romano", null)).toBe(false);
  });
});

describe("companyNameFromSubject recovers the names the placeholders are missing", () => {
  it("finds the real name in a later message from the same domain", () => {
    // The first borsalab.io message ("Accessi aggiuntivi piattaforma") has no
    // company name, which is why the company ended up named after its domain;
    // a later one states it outright.
    expect(companyNameFromSubject("Proposta commerciale Yuno — Fintech Borsa Lab")).toBe("Fintech Borsa Lab");
    expect(companyNameFromSubject("Re: Proposta commerciale Yuno — Capital Gate Partners")).toBe(
      "Capital Gate Partners"
    );
  });

  it("returns null for the subjects that produced the placeholders", () => {
    expect(companyNameFromSubject("Accessi aggiuntivi piattaforma")).toBeNull();
    expect(companyNameFromSubject("Info piano Enterprise per Capital Gate Partners")).toBeNull();
  });
});

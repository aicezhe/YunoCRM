import { describe, expect, it } from "vitest";
import { INDUSTRY_TERMS, embeddingText, industryHints } from "./embedding-rules";

describe("industryHints", () => {
  it("translates the Italian trade term into English industry hints", () => {
    // The whole point: a user searching in English never types "Caseificio",
    // so the embedded text has to carry "dairy"/"cheese" itself.
    expect(industryHints("Caseificio Valpadana")).toContain("cheese producer");
    expect(industryHints("Fonderia Valchiavenna")).toContain("foundry");
    expect(industryHints("Tessitura Comasca")).toContain("textiles");
    expect(industryHints("Trasporti Eccezionali TEV")).toContain("trucking");
    expect(industryHints("Studio Legale Aureli")).toContain("law firm");
    expect(industryHints("Vini Colline Toscane")).toContain("winery");
    expect(industryHints("Banca Orobica")).toContain("bank");
  });

  it("is case-insensitive", () => {
    expect(industryHints("FONDERIE RIUNITE")).toContain("foundry");
    expect(industryHints("fonderie riunite")).toContain("foundry");
  });

  it("deduplicates hints when several terms imply the same industry", () => {
    // "Studio Legale" matches both the /studio legale/ and /studio/ rules.
    const hints = industryHints("Studio Legale Aureli");
    expect(hints.length).toBe(new Set(hints).size);
  });

  it("returns nothing for a name with no recognisable trade term", () => {
    expect(industryHints("Cliente di Andrea Romano")).toEqual([]);
  });

  it("every rule actually fires on the real company it cites", () => {
    // Guards against a regex that was tightened or a name that changed:
    // each entry documents the dataset company that justifies it.
    for (const { term, example, hints } of INDUSTRY_TERMS) {
      expect(term.test(example), `${term} should match its example "${example}"`).toBe(true);
      expect(industryHints(example), `"${example}" should get its own hints`).toEqual(expect.arrayContaining(hints));
    }
  });
});

describe("embeddingText", () => {
  const company = {
    name: "Caseificio Valpadana",
    domain: "caseificiovalpadana.it",
    channel: "linkedin_outbound",
    stage: "Negotiation",
  };

  it("reads as prose and carries the translated industry", () => {
    const text = embeddingText(company);
    expect(text).toContain("Caseificio Valpadana is a company in");
    expect(text).toContain("cheese producer");
    expect(text).toContain("caseificiovalpadana.it");
    expect(text).toContain("Negotiation");
  });

  it("spells the channel out instead of leaking the enum's underscores", () => {
    expect(embeddingText(company)).toContain("linkedin outbound channel");
    expect(embeddingText(company)).not.toContain("linkedin_outbound");
  });

  it("degrades cleanly when a company has no prospect or domain yet", () => {
    const bare = { name: "Cliente di Andrea Romano", domain: null, channel: null, stage: null };
    expect(embeddingText(bare)).toBe("Cliente di Andrea Romano is a company.");
  });
});

import { describe, expect, it } from "vitest";
import { DANGOTE_COMPANY_PROFILE } from "./dangote-company-profile";

describe("verified Dangote refinery profile", () => {
  it("distinguishes the refinery CEO from the chairman", () => {
    expect(DANGOTE_COMPANY_PROFILE.facts).toContainEqual({
      label: "Chief executive / Managing director",
      value: "David Bird",
    });
    expect(DANGOTE_COMPANY_PROFILE.facts).toContainEqual({
      label: "Chairman",
      value: "Aliko Dangote",
    });
  });
  it("links to official sources and does not invent founding or employee figures", () => {
    expect(
      DANGOTE_COMPANY_PROFILE.sources.every(
        (source) => new URL(source.url).hostname === "refinery.dangote.com",
      ),
    ).toBe(true);
    expect(
      DANGOTE_COMPANY_PROFILE.facts.some((fact) =>
        /employees|founded/i.test(fact.label),
      ),
    ).toBe(false);
    expect(DANGOTE_COMPANY_PROFILE.reviewedAt).toBe("2026-10-14");
  });
});

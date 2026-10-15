import { describe, expect, it } from "vitest";
import { getCompanyLogoUrl } from "./stock-branding";

describe("getCompanyLogoUrl", () => {
  it("uses the full-resolution official refinery logo for DPRI", () => {
    expect(getCompanyLogoUrl(" dpri ")).toBe("/dangote-refinery-logo.png");
  });

  it("does not override listings without a registered company logo", () => {
    expect(getCompanyLogoUrl("UNKNOWN")).toBeUndefined();
  });

  it("uses company logos for featured equities", () => {
    expect(getCompanyLogoUrl("AAPL")).toContain("apple.com");
    expect(getCompanyLogoUrl("AMZN")).toContain("amazon.com");
    expect(getCompanyLogoUrl("GOOGL")).toContain("google.com");
  });
});

import { describe, expect, it } from "vitest";
import { getCompanyLogoUrl } from "./stock-branding";

describe("getCompanyLogoUrl", () => {
  it("uses Dangote's official domain for the DPRI listing", () => {
    expect(getCompanyLogoUrl("dpri")).toContain("dangote.com");
  });

  it("does not override listings without a registered company logo", () => {
    expect(getCompanyLogoUrl("AAPL")).toBeUndefined();
  });
});

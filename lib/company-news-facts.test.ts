import { describe, expect, it } from "vitest";
import { extractCompanyNewsFacts } from "./company-news-facts";
import { getCompanyNewsQuery } from "./company-news";

const article = (title: string, summary?: string) => ({
  title,
  summary,
  source: "Publisher",
  url: "https://example.com/story",
  publishedAt: new Date(Date.now() - 86400000).toISOString(),
});

describe("news-reported company facts", () => {
  it("extracts explicit statements with source attribution", () => {
    const facts = extractCompanyNewsFacts(
      [
        article("Trump Media appoints Jane Smith as CEO"),
        article(
          "Company background",
          "Trump Media was founded in 2021. Trump Media is headquartered in Sarasota, Florida. Trump Media employs 100 employees.",
        ),
      ],
      "Trump Media",
      "DJT",
    );
    expect(facts.ceo).toMatchObject({
      value: "Jane Smith",
      source: "Publisher",
      url: "https://example.com/story",
    });
    expect(facts.headquarters?.value).toBe("Sarasota, Florida");
    expect(facts.founded?.value).toBe("2021");
    expect(facts.employees?.value).toBe("100");
  });
  it("does not attribute unrelated company or political facts", () => {
    expect(
      extractCompanyNewsFacts(
        [
          article("Apple appoints Jane Smith as CEO"),
          article("Trump appoints Jane Smith as press secretary"),
          article("Trump Media shares fall"),
        ],
        "Trump Media",
        "DJT",
      ),
    ).toEqual({});
  });
  it("does not reuse stale leadership claims", () => {
    expect(
      extractCompanyNewsFacts(
        [
          {
            ...article("Trump Media appoints Jane Smith as CEO"),
            publishedAt: "2020-01-01T00:00:00Z",
          },
        ],
        "Trump Media",
        "DJT",
      ),
    ).toEqual({});
  });
  it("uses company phrases rather than broad political words or tickers", () => {
    expect(getCompanyNewsQuery("DJT", "Trump Media")).toContain(
      '"Trump Media & Technology Group"',
    );
    expect(
      getCompanyNewsQuery("DPRI", "Dangote Petroleum Refinery IPO"),
    ).toContain('"Dangote Refinery"');
  });
});

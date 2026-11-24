import { describe, expect, it } from "vitest";
import {
  formatNewsTimestamp,
  getCompanyNewsName,
  normalizeCompanyNews,
  parseGoogleNewsRss,
} from "./company-news";

describe("Finnhub company news", () => {
  it("preserves source-provided Finnhub images and rejects unsafe URLs", () => {
    const story = {
      headline: "Company news",
      url: "https://example.com/story",
      image: "https://example.com/photo.jpg",
    };
    expect(normalizeCompanyNews([story])[0].imageUrl).toBe(story.image);
    expect(
      normalizeCompanyNews([{ ...story, image: "javascript:alert(1)" }])[0]
        .imageUrl,
    ).toBeUndefined();
  });
  it("reads RSS media thumbnails, image enclosures and description images", () => {
    for (const image of [
      '<media:thumbnail url="https://example.com/photo.jpg"/>',
      '<enclosure type="image/jpeg" url="https://example.com/photo.jpg"/>',
      '<description><![CDATA[<img src="https://example.com/photo.jpg">]]></description>',
    ]) {
      expect(
        parseGoogleNewsRss(
          `<rss><item><title>News</title><link>https://example.com/story</link>${image}</item></rss>`,
        )[0].imageUrl,
      ).toBe("https://example.com/photo.jpg");
    }
  });
  it("does not treat a video enclosure as a thumbnail", () => {
    expect(
      parseGoogleNewsRss(
        '<rss><item><title>News</title><link>https://example.com/story</link><enclosure type="video/mp4" url="https://example.com/movie.mp4"/></item></rss>',
      )[0].imageUrl,
    ).toBeUndefined();
  });
  it("uses company names without provider or IPO suffixes", () => {
    expect(getCompanyNewsName("Apple Inc. Tokenized Stock")).toBe("Apple Inc.");
    expect(getCompanyNewsName("Apple xStock")).toBe("Apple");
    expect(getCompanyNewsName("Dangote Petroleum Refinery IPO")).toBe(
      "Dangote Petroleum Refinery",
    );
  });
  it("normalizes Google RSS with CDATA, entities, source attributes and dates", () => {
    expect(
      parseGoogleNewsRss(
        '<rss><channel><item><title><![CDATA[Apple &amp; markets]]></title><link>https://news.example/apple</link><source url="https://news.example">Reuters</source><pubDate>Wed, 14 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>',
      ),
    ).toEqual([
      {
        title: "Apple & markets",
        url: "https://news.example/apple",
        source: "Reuters",
        publishedAt: "2026-10-14T10:00:00.000Z",
      },
    ]);
    expect(parseGoogleNewsRss("<rss><channel/></rss>")).toEqual([]);
  });
  it("maps headlines and Unix timestamps and sorts newest first", () => {
    const items = normalizeCompanyNews([
      {
        headline: "Older",
        url: "https://news.example/old",
        source: "Publisher",
        datetime: 100,
      },
      {
        headline: " Newer ",
        url: "https://news.example/new",
        source: " Reuters ",
        datetime: 200,
      },
    ]);
    expect(items[0]).toEqual({
      title: "Newer",
      url: "https://news.example/new",
      source: "Reuters",
      publishedAt: "1970-01-01T00:03:20.000Z",
    });
    expect(items[1].title).toBe("Older");
  });

  it("rejects invalid stories and unsafe URLs and removes duplicates", () => {
    const story = {
      headline: "News",
      url: "https://news.example/article",
      datetime: 100,
    };
    expect(
      normalizeCompanyNews([
        null,
        {},
        story,
        story,
        { ...story, url: "javascript:alert(1)" },
        { ...story, url: "not-a-url" },
      ]),
    ).toHaveLength(1);
  });

  it("limits results to ten stories", () => {
    expect(
      normalizeCompanyNews(
        Array.from({ length: 15 }, (_, id) => ({
          headline: String(id),
          url: `https://news.example/${id}`,
          datetime: id + 1,
        })),
      ),
    ).toHaveLength(10);
  });

  it("handles missing or invalid publication timestamps", () => {
    expect(
      normalizeCompanyNews([
        { headline: "News", url: "https://news.example", datetime: Infinity },
      ])[0],
    ).toMatchObject({ source: "Finnhub", publishedAt: "" });
    expect(normalizeCompanyNews([])).toEqual([]);
  });

  describe("formatNewsTimestamp", () => {
    const now = new Date("2026-11-23T16:00:00.000Z").getTime();

    it("uses hours for same-day articles", () => {
      // 2 hours ago
      const twoHoursAgo = new Date(now - 2 * 3600 * 1000).toISOString();
      expect(formatNewsTimestamp(twoHoursAgo, now)).toBe("2 hrs ago");

      // 5 hours ago
      const fiveHoursAgo = new Date(now - 5 * 3600 * 1000).toISOString();
      expect(formatNewsTimestamp(fiveHoursAgo, now)).toBe("5 hrs ago");

      // 1 hour ago
      const oneHourAgo = new Date(now - 1 * 3600 * 1000).toISOString();
      expect(formatNewsTimestamp(oneHourAgo, now)).toBe("1 hr ago");

      // 25 minutes ago
      const minsAgo = new Date(now - 25 * 60 * 1000).toISOString();
      expect(formatNewsTimestamp(minsAgo, now)).toBe("25 mins ago");

      // Less than 1 minute ago
      const justNow = new Date(now - 30 * 1000).toISOString();
      expect(formatNewsTimestamp(justNow, now)).toBe("Just now");
    });

    it("uses days up to 3 days ago", () => {
      // 1 day ago (26 hours)
      const oneDayAgo = new Date(now - 26 * 3600 * 1000).toISOString();
      expect(formatNewsTimestamp(oneDayAgo, now)).toBe("1 day ago");

      // 2 days ago (50 hours)
      const twoDaysAgo = new Date(now - 50 * 3600 * 1000).toISOString();
      expect(formatNewsTimestamp(twoDaysAgo, now)).toBe("2 days ago");

      // 3 days ago (75 hours)
      const threeDaysAgo = new Date(now - 75 * 3600 * 1000).toISOString();
      expect(formatNewsTimestamp(threeDaysAgo, now)).toBe("3 days ago");
    });

    it("uses formatted date from 4 days onwards", () => {
      // 4 days ago (98 hours) -> Nov 19, 2026
      const fourDaysAgo = new Date(now - 98 * 3600 * 1000).toISOString();
      expect(formatNewsTimestamp(fourDaysAgo, now)).toBe("Nov 19, 2026");

      // 10 days ago -> Nov 13, 2026
      const tenDaysAgo = new Date(now - 10 * 24 * 3600 * 1000).toISOString();
      expect(formatNewsTimestamp(tenDaysAgo, now)).toBe("Nov 13, 2026");
    });

    it("handles invalid or empty timestamps gracefully", () => {
      expect(formatNewsTimestamp("", now)).toBe("");
      expect(formatNewsTimestamp("invalid-date", now)).toBe("");
    });
  });
});

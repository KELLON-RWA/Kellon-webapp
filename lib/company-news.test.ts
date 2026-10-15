import { describe, expect, it } from "vitest";
import {
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

  it("limits results to six stories", () => {
    expect(
      normalizeCompanyNews(
        Array.from({ length: 10 }, (_, id) => ({
          headline: String(id),
          url: `https://news.example/${id}`,
          datetime: id + 1,
        })),
      ),
    ).toHaveLength(6);
  });

  it("handles missing or invalid publication timestamps", () => {
    expect(
      normalizeCompanyNews([
        { headline: "News", url: "https://news.example", datetime: Infinity },
      ])[0],
    ).toMatchObject({ source: "Finnhub", publishedAt: "" });
    expect(normalizeCompanyNews([])).toEqual([]);
  });
});

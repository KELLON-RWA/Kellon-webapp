import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const get = (symbol = "AAPL") =>
  GET(
    new Request(
      `http://localhost/api/market/company/${encodeURIComponent(symbol)}?name=Apple`,
    ),
    { params: Promise.resolve({ symbol }) },
  );
afterEach(() => vi.unstubAllGlobals());

describe("company profile route", () => {
  it("returns a pinned entity with a public source link and server-side caching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          entities: {
            Q312: {
              id: "Q312",
              labels: { en: { value: "Apple Inc." } },
              claims: {},
            },
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await get()).json()).toMatchObject({
      profile: {
        name: "Apple Inc.",
        source: "Wikidata",
        sourceUrl: "https://www.wikidata.org/wiki/Q312",
      },
    });
    expect(fetchMock.mock.calls[0][1].next.revalidate).toBe(86400);
  });
  it("rejects invalid symbols without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await get("BAD?key=x")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns a recoverable error on an upstream outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network")));
    expect((await get()).status).toBe(502);
  });
  it("does not treat an arbitrary search hit as the company", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ search: [{ id: "Q1" }] })),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ entities: { Q1: { id: "Q1", claims: {} } } }),
          ),
        ),
    );
    expect(await (await get("OTHER")).json()).toEqual({ profile: null });
  });
});

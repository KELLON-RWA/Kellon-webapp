import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("Stock Real-time Stream API (SSE)", () => {
  it("initializes an SSE stream with proper headers and connected payload", async () => {
    const res = await GET(new Request("http://localhost/api/market/stocks/AAPL/stream"), {
      params: Promise.resolve({ symbol: "AAPL" }),
    });

    expect(res.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain("event: message");
    expect(text).toContain('"type":"connected"');
    expect(text).toContain('"symbol":"AAPL"');

    await reader!.cancel();
  });

  it("rejects invalid or malformed stock symbols with 400", async () => {
    const res = await GET(
      new Request("http://localhost/api/market/stocks/INVALID%20NAME/stream"),
      {
        params: Promise.resolve({ symbol: "INVALID NAME<script>" }),
      },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBe("Invalid stock symbol");
  });
});

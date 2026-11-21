import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

function createMockRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/geo", {
    headers: new Headers(headers),
  });
}

describe("GET /api/geo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("prioritizes x-vercel-ip-country header when valid", async () => {
    const req = createMockRequest({
      "x-vercel-ip-country": "gh",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ country: "GH", country_code: "GH" });
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("extracts cf-ipcountry header when valid", async () => {
    const req = createMockRequest({
      "cf-ipcountry": "ke",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ country: "KE", country_code: "KE" });
  });

  it("ignores Cloudflare pseudo-country codes (XX, T1)", async () => {
    const req = createMockRequest({
      "cf-ipcountry": "XX",
      "x-forwarded-for": "127.0.0.1",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Falls back to safe default
    expect(body.country).toBe("NG");
  });

  it("rejects malformed country code strings", async () => {
    const req = createMockRequest({
      "x-vercel-ip-country": "USA123<script>",
      "x-forwarded-for": "127.0.0.1",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.country).toBe("NG");
  });

  it("ignores untrusted x-country-code in production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = createMockRequest({
      "x-country-code": "US",
      "x-forwarded-for": "127.0.0.1",
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body.country).toBe("NG");
  });

  it("permits x-country-code dev override in non-production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const req = createMockRequest({
      "x-country-code": "US",
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body).toEqual({ country: "US", country_code: "US" });
  });

  it("handles private local IPs without making external requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const req = createMockRequest({
      "x-forwarded-for": "192.168.1.100, 10.0.0.1",
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body.country).toBe("NG");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

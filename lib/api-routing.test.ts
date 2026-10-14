import { afterEach, describe, expect, it, vi } from "vitest";

describe("local API route precedence", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("proxies unmatched API paths only after local dynamic routes", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_BACKEND_API_URL",
      "https://backend.example/api/v1/",
    );
    vi.resetModules();
    const { default: config } = await import("../next.config");
    expect(await config.rewrites?.()).toEqual({
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/api/:path*",
          destination: "https://backend.example/api/v1/:path*",
        },
      ],
    });
  });

  it("does not install a proxy when no backend is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_API_URL", "");
    vi.resetModules();
    const { default: config } = await import("../next.config");
    expect(await config.rewrites?.()).toEqual([]);
  });
});

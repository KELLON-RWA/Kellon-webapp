import { describe, expect, it } from "vitest";

describe("security headers configuration", () => {
  it("defines comprehensive security headers for all routes", async () => {
    const { default: config } = await import("../next.config");
    const headersList = await config.headers?.();

    expect(headersList).toBeDefined();

    const globalHeadersConfig = headersList?.find(
      (entry) => entry.source === "/:path*",
    );
    expect(globalHeadersConfig).toBeDefined();

    const headerMap = new Map(
      globalHeadersConfig?.headers.map((h) => [h.key, h.value]),
    );

    // Clickjacking defenses
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );

    // MIME sniffing defense
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");

    // HSTS enforcement
    expect(headerMap.get("Strict-Transport-Security")).toContain(
      "max-age=63072000",
    );
    expect(headerMap.get("Strict-Transport-Security")).toContain(
      "includeSubDomains",
    );

    // Referrer policy
    expect(headerMap.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );

    // Feature policy restriction
    expect(headerMap.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );

    // DNS prefetch control
    expect(headerMap.get("X-DNS-Prefetch-Control")).toBe("on");
  });

  it("preserves static asset and well-known configuration", async () => {
    const { default: config } = await import("../next.config");
    const headersList = await config.headers?.();

    const stellarConfig = headersList?.find(
      (entry) => entry.source === "/.well-known/stellar.toml",
    );
    expect(stellarConfig).toBeDefined();

    const fontsConfig = headersList?.find(
      (entry) => entry.source === "/fonts/:path*",
    );
    expect(fontsConfig).toBeDefined();

    const manifestConfig = headersList?.find(
      (entry) => entry.source === "/manifest.json",
    );
    expect(manifestConfig).toBeDefined();
  });
});

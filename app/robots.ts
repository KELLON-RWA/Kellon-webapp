import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/onboarding", "/favicon.ico", "/logo.png", "/manifest.json"],
      disallow: [
        "/",
        "/buy",
        "/send",
        "/receive",
        "/withdraw",
        "/transactions",
        "/notifications",
        "/settings",
        "/invoices",
        "/gifts",
        "/earn",
        "/cards",
        "/continue",
        "/api",
      ],
    },
    sitemap: "https://www.kellon.xyz/sitemap.xml",
    host: "https://www.kellon.xyz",
  };
}

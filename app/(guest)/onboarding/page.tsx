import type { Metadata } from "next";
import OnboardingPageClient from "@/components/guest/OnboardingPageClient";

export const metadata: Metadata = {
  title: "Borderless Stablecoin Payments",
  description:
    "Get started with Kellon for borderless payments, global investments, and one wallet that moves with you.",
  alternates: {
    canonical: "/onboarding",
  },
  openGraph: {
    url: "/onboarding",
    title: "Kellon — Borderless Stablecoin Payments",
    description:
      "Send, receive, buy, withdraw, and earn with stablecoins in one secure wallet.",
  },
};

export default function OnboardingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Kellon",
    url: "https://www.kellon.xyz/onboarding",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    description:
      "A borderless wallet for stablecoin payments and global financial access.",
  };

  return (
    <main id="main-content" tabIndex={-1}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <OnboardingPageClient />
    </main>
  );
}

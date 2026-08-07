import type { Metadata, Viewport } from "next";
import "./globals.css";
import Provider from "@/components/providers/Provider";

const siteUrl = "https://www.kellon.xyz";
const siteDescription =
  "Buy, hold, send, receive, withdraw, and earn with stablecoins through one secure borderless finance wallet.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kellon — Borderless Stablecoin Wallet",
    template: "%s | Kellon",
  },
  description: siteDescription,
  manifest: "/manifest.json",
  applicationName: "Kellon",
  keywords: [
    "Kellon",
    "borderless payments",
    "global investments",
    "wallet",
    "crypto wallet",
    "cross-border payments",
    "stablecoin payments",
    "send money",
    "receive crypto",
    "buy crypto",
  ],
  category: "finance",
  creator: "Kellon",
  publisher: "Kellon",
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    url: "https://www.kellon.xyz/",
    siteName: "Kellon",
    title: "Kellon — Borderless Stablecoin Wallet",
    description: siteDescription,
    images: [
      {
        url: "/logo.png",
        width: 500,
        height: 500,
        alt: "Kellon",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kellon — Borderless Stablecoin Wallet",
    description: siteDescription,
    images: ["/logo.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Kellon",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-white px-4 py-2 font-semibold text-cryptoNight shadow-lg transition-transform focus:translate-y-0 dark:bg-secondary-60 dark:text-white"
        >
          Skip to main content
        </a>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}

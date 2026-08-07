import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Swap Unavailable",
  description: "Kellon Swap is currently unavailable.",
  robots: { index: false, follow: false, nocache: true },
};

// Swap is intentionally isolated from the production bundle until its LI.FI
// dependency tree is upgraded and tested independently from the wallet release.
export default function SwapUnavailablePage() {
  return (
    <section
      aria-labelledby="swap-unavailable-title"
      className="mx-auto flex min-h-[70dvh] w-11/12 max-w-lg flex-col items-center justify-center text-center"
    >
      <h1
        id="swap-unavailable-title"
        className="text-3xl font-bold text-cryptoNight dark:text-white"
      >
        Swap is temporarily unavailable
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-300">
        We&apos;re preparing a safer swap experience. Your wallet, payments, and
        other Kellon services remain available.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-primary-50 px-5 py-3 text-sm font-semibold text-white outline-none transition hover:bg-primary-40 focus-visible:ring-4 focus-visible:ring-primary-70/30"
      >
        Return to wallet
      </Link>
    </section>
  );
}

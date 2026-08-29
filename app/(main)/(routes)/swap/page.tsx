import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SwapFlow from "@/components/wallet/swap/SwapFlow";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

export const metadata: Metadata = {
  title: "Swap",
  description: "Swap tokens through LI.FI on supported Kellon wallet networks.",
  alternates: { canonical: "/swap" },
};

export default async function SwapPage() {
  const profile = (await currentProfile()) as User;
  if (!profile) redirect("/");
  return <SwapFlow profile={profile} />;
}

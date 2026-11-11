import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BridgeFlow from "@/components/wallet/bridge/BridgeFlow";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

export const metadata: Metadata = {
  title: "Swap",
  description: "Swap between USDC and USDT on supported networks.",
  alternates: { canonical: "/swap" },
};

interface SwapPageProps {
  searchParams: Promise<{ asset?: string; network?: string }>;
}

export default async function SwapPage({ searchParams }: SwapPageProps) {
  const profile = (await currentProfile()) as User;
  if (!profile) redirect("/");

  const { asset, network } = await searchParams;
  const normalizedAsset = asset?.toUpperCase();
  const initialSymbol =
    normalizedAsset === "USDC" || normalizedAsset === "USDT"
      ? normalizedAsset
      : undefined;

  return (
    <BridgeFlow
      profile={profile}
      initialMode="swap"
      initialSymbol={initialSymbol}
      initialSourceChain={network?.toLowerCase()}
    />
  );
}

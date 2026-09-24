import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BridgeFlow from "@/components/wallet/bridge/BridgeFlow";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

export const metadata: Metadata = {
  title: "Bridge",
  description: "Bridge USDC and USDT between supported Kellon wallet networks.",
  alternates: { canonical: "/bridge" },
};

interface BridgePageProps {
  searchParams: Promise<{ asset?: string; network?: string }>;
}

export default async function BridgePage({ searchParams }: BridgePageProps) {
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
      initialSymbol={initialSymbol}
      initialSourceChain={network?.toLowerCase()}
    />
  );
}

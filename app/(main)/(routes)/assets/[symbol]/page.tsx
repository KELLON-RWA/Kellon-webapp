import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AssetDetailsPage from "@/components/wallet/assets/AssetDetailsPage";
import { currentProfile } from "@/lib/current-profile";
import { getAssetName } from "@/lib/dashboard-utils";
import type { User } from "@/types/db";

interface PageProps {
  params: Promise<{
    symbol: string;
  }>;
  searchParams: Promise<{
    network?: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const normalizedSymbol = symbol.toUpperCase();

  return {
    title: `${normalizedSymbol} Asset`,
    description: `View your ${getAssetName(normalizedSymbol)} balance and distribution across supported networks.`,
    alternates: {
      canonical: `/assets/${normalizedSymbol.toLowerCase()}`,
    },
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const profile = (await currentProfile()) as User;
  if (!profile) redirect("/continue");

  const { symbol } = await params;
  const { network } = await searchParams;

  return (
    <AssetDetailsPage
      profile={profile}
      symbol={symbol}
      initialChain={network?.toLowerCase()}
    />
  );
}

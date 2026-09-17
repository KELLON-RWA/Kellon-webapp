import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StockDetailsPage from "@/components/earn/StockDetailsPage";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const ticker = symbol.toUpperCase();

  return {
    title: `${ticker} Stock`,
    description: `View ${ticker} price, performance, and tokenized stock details on Kellon.`,
    alternates: { canonical: `/earn/stocks/${symbol.toLowerCase()}` },
  };
}

export default async function StockDetailsRoute({ params }: PageProps) {
  const profile = (await currentProfile()) as User;
  if (!profile) redirect("/");

  const { symbol } = await params;
  return <StockDetailsPage profile={profile} symbol={symbol} />;
}

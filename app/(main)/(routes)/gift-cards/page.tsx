import type { Metadata } from "next";
import { redirect } from "next/navigation";
import GiftCardsPage from "@/components/giftcards/GiftCardsPage";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

export const metadata: Metadata = {
  title: "Gift cards",
  description:
    "Buy gift cards with crypto, or sell gift cards you own for USDC.",
  alternates: {
    canonical: "/gift-cards",
  },
};

export default async function GiftCardsRoute() {
  const profile = (await currentProfile()) as User;

  if (!profile) {
    redirect("/");
  }

  return <GiftCardsPage profile={profile} />;
}

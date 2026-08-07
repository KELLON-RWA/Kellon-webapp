import BuyCryptoFlowManager from "@/components/wallet/buy-crypto/BuyCryptoFlowManager";
import { currentProfile } from "@/lib/current-profile";
import { User } from "@/types/db";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buy Crypto",
  description:
    "Buy digital assets on Kellon with a smooth local-to-crypto payment flow.",
  alternates: {
    canonical: "/buy",
  },
};

export default async function BuyPage() {
  const profile = (await currentProfile()) as User;

  if (!profile) redirect("/");
  return (
    <div className="min-h-[100dvh]">
      <BuyCryptoFlowManager />
    </div>
  );
}

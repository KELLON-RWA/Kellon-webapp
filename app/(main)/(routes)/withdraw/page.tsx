import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { User } from "@/types/db";
import { currentProfile } from "@/lib/current-profile";
import WithdrawFlowManager from "@/components/wallet/withdraw/WithdrawFlowManager";

export const metadata: Metadata = {
  title: "Withdraw",
  description:
    "Withdraw funds from your Kellon wallet using supported providers and a verified bank account.",
  alternates: {
    canonical: "/withdraw",
  },
};

export default async function WithdrawPage() {
  const profile = (await currentProfile()) as User;

  if (!profile) {
    redirect("/");
  }

  return (
    <div className="min-h-[100dvh]">
      <WithdrawFlowManager profile={profile} />
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RewardsPage from "@/components/rewards/RewardsPage";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

export const metadata: Metadata = {
  title: "Rewards",
  description: "Earn points for your activity and invite friends to Kellon.",
  alternates: {
    canonical: "/rewards",
  },
};

export default async function RewardsRoute({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const profile = (await currentProfile()) as User;

  if (!profile) {
    redirect("/");
  }

  const { ref } = await searchParams;

  return <RewardsPage profile={profile} referralCode={ref} />;
}

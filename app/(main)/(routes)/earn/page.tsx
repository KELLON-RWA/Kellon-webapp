import type { Metadata } from "next";
import { redirect } from "next/navigation";
import EarnPage from "@/components/earn/EarnPage";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

export const metadata: Metadata = {
  title: "Earn",
  description:
    "Grow your stablecoins with curated yield opportunities in your Kellon wallet.",
  alternates: {
    canonical: "/earn",
  },
};

export default async function EarnRoute() {
  const profile = (await currentProfile()) as User;

  if (!profile) {
    redirect("/");
  }

  return <EarnPage profile={profile} />;
}

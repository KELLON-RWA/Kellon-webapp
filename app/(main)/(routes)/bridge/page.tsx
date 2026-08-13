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

export default async function BridgePage() {
  const profile = (await currentProfile()) as User;
  if (!profile) redirect("/");

  return <BridgeFlow profile={profile} />;
}
